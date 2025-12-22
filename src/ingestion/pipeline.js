// src/ingestion/pipeline.js
// Ingestion Pipeline
(function (scope) {
  async function resolveDestination(destination) {
    if (!destination || !destination.type) {
      throw { code: 'destination', message: 'No destination provided' };
    }

    if (destination.type === 'select') {
      if (!destination.id) {
        throw { code: 'destination', message: 'No notebook selected' };
      }
      return {
        id: destination.id,
        title: destination.title || 'Existing Notebook',
        created: false,
      };
    }

    if (destination.type === 'create') {
      if (!destination.title || !destination.title.trim()) {
        throw { code: 'destination', message: 'Notebook title is required' };
      }
      const created = await scope.NLM_Client.createNotebook(destination.title.trim());
      return { id: created.id, title: created.title, created: true };
    }

    throw { code: 'destination', message: `Unknown destination type: ${destination.type}` };
  }

  function hasSelection(raw) {
    return raw && raw.selection && raw.selection.trim().length > 0;
  }

  function hasConversation(raw) {
    return raw && Array.isArray(raw.messages) && raw.messages.length > 0;
  }

  async function waitForRetryDelay(jobId, attempt) {
    const delayMs = 400 * attempt;
    const alarmName = `conduit_retry_${jobId}_${attempt}`;

    return new Promise((resolve) => {
      const handler = (alarm) => {
        if (!alarm || alarm.name !== alarmName) return;
        browser.alarms.onAlarm.removeListener(handler);
        resolve();
      };

      browser.alarms.onAlarm.addListener(handler);
      browser.alarms.create(alarmName, { when: Date.now() + delayMs });
    });
  }

  async function addSourceWithRetry(jobId, addFn) {
    const attempts = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await addFn();
        return;
      } catch (error) {
        lastError = error;
        if (attempt < attempts) {
          await waitForRetryDelay(jobId, attempt);
        }
      }
    }

    throw lastError || { code: 'source_ingest', message: 'Failed to add source' };
  }

  scope.Pipeline = {
    handleListNotebooks: async function () {
      try {
        return await scope.NLM_Client.listNotebooks();
      } catch (error) {
        throw scope.ConduitErrors.normalizeError(
          error,
          'notebook_list',
          'Failed to list notebooks'
        );
      }
    },

    handleSend: async function (request) {
      await scope.JobStore.sweepStaleJobs();
      const job = await scope.JobStore.createJob({ request });

      try {
        const tab = await scope.Extractor.getActiveTab();
        await scope.JobStore.updateJob(job.id, {
          status: 'in_progress',
          tabId: tab.id,
          tabUrl: tab.url,
        });

        const intent = request.intent || 'auto';
        let raw = null;
        let normalized = null;
        const url = tab.url;

        if (intent === 'selection' || intent === 'auto') {
          raw = await scope.Extractor.extractSelection(tab);
          if (hasSelection(raw)) {
            normalized = scope.ConduitNormalize.normalizeSelection(raw);
          } else if (intent === 'selection') {
            throw { code: 'selection_empty', message: 'No text selected to send' };
          }
        }

        if (!normalized && (intent === 'chat' || intent === 'auto')) {
          const matches = scope.Extractor.detectSources(url).filter(
            (source) => source.id === 'chatgpt' || source.id === 'gemini'
          );
          const source = matches[0];
          if (source) {
            raw = await scope.Extractor.extractSourceById(tab, source.id);
            if (!hasConversation(raw)) {
              throw { code: 'extract', message: 'Conversation content not found' };
            }
            normalized = scope.ConduitNormalize.normalizeConversation(raw, source.label);
          } else if (intent === 'chat') {
            throw { code: 'unsupported', message: 'This page is not a supported chat source' };
          }
        }

        if (!normalized && (intent === 'gdoc' || intent === 'auto')) {
          const matches = scope.Extractor.detectSources(url).filter((source) => source.id === 'gdoc');
          const source = matches[0];
          if (source) {
            raw = await scope.Extractor.extractSourceById(tab, source.id);
            if (!raw.docId) {
              throw { code: 'extract', message: 'Google Doc ID not found' };
            }
            normalized = scope.ConduitNormalize.normalizeGDoc(raw);
          } else if (intent === 'gdoc') {
            throw { code: 'unsupported', message: 'This page is not a Google Doc' };
          }
        }

        if (!normalized && (intent === 'page' || intent === 'auto')) {
          raw = await scope.Extractor.extractSourceById(tab, 'web');
          if (!raw.content || !raw.content.trim()) {
            throw { code: 'extract', message: 'No readable page content found' };
          }
          normalized = scope.ConduitNormalize.normalizeWebPage(raw);
        }

        if (!normalized) {
          throw { code: 'extract', message: 'Unable to extract content for this page' };
        }

        const resolvedDestination = await resolveDestination(request.destination);
        const notebookId = resolvedDestination.id;
        const notebookTitle = resolvedDestination.title;

        if (normalized.sourceType === 'gdoc') {
          const docId = normalized.metadata ? normalized.metadata.docId : null;
          if (!docId) {
            throw { code: 'extract', message: 'Missing Google Doc ID for ingestion' };
          }
          if (resolvedDestination.created) {
            await addSourceWithRetry(job.id, () =>
              scope.NLM_Client.addGDocSource(notebookId, docId, normalized.title)
            );
          } else {
            await scope.NLM_Client.addGDocSource(notebookId, docId, normalized.title);
          }
        } else {
          if (resolvedDestination.created) {
            await addSourceWithRetry(job.id, () =>
              scope.NLM_Client.addTextSource(notebookId, normalized.title, normalized.content)
            );
          } else {
            await scope.NLM_Client.addTextSource(
              notebookId,
              normalized.title,
              normalized.content
            );
          }
        }

        const result = {
          status: 'ingested',
          notebookId: notebookId,
          notebookTitle: notebookTitle,
          sourceTitle: normalized.title,
          sourceType: normalized.sourceType,
        };

        await scope.JobStore.completeJob(job.id, result);
        return result;
      } catch (error) {
        const normalizedError = scope.ConduitErrors.normalizeError(
          error,
          'send_failed',
          'Send failed'
        );
        await scope.JobStore.failJob(job.id, normalizedError);
        throw normalizedError;
      }
    },
  };
})(globalThis);
