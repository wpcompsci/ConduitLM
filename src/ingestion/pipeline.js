// src/ingestion/pipeline.js
// Ingestion Pipeline
(function (scope) {
  async function resolveDestination(destination, jobId) {
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
      const trimmedTitle = destination.title.trim();
      try {
        const created = await scope.NLM_Client.createNotebook(trimmedTitle);
        return { id: created.id, title: created.title, created: true };
      } catch (error) {
        if (error && error.code === 'parse') {
          const recovered = await recoverNotebookId(trimmedTitle, jobId);
          if (recovered) {
            return { id: recovered.id, title: recovered.title, created: true };
          }
        }
        throw error;
      }
    }

    throw { code: 'destination', message: `Unknown destination type: ${destination.type}` };
  }

  function hasSelection(raw) {
    return raw && raw.selection && raw.selection.trim().length > 0;
  }

  function hasConversation(raw) {
    return raw && Array.isArray(raw.messages) && raw.messages.length > 0;
  }

  async function ensureOptionalHostAccess(url) {
    if (!scope.ConduitHosts || typeof scope.ConduitHosts.getOptionalOrigin !== 'function') {
      return;
    }
    const origin = scope.ConduitHosts.getOptionalOrigin(url);
    if (!origin) return;
    const hasPermission = await browser.permissions.contains({ origins: [origin] });
    if (!hasPermission) {
      throw {
        code: 'permission',
        message: 'Access to this site is not enabled. Use the popup to grant access.',
        detail: { origin },
      };
    }
  }

  function sameOrigin(urlA, urlB) {
    if (!urlA || !urlB) return true;
    try {
      return new URL(urlA).origin === new URL(urlB).origin;
    } catch (e) {
      return true;
    }
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

  async function recoverNotebookId(title, jobId) {
    const attempts = 3;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const notebooks = await scope.NLM_Client.listNotebooks();
      const match = notebooks.find((nb) => nb.title === title);
      if (match) {
        return { id: match.id, title: match.title };
      }
      if (attempt < attempts) {
        await waitForRetryDelay(jobId, attempt);
      }
    }

    return null;
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
        const tab = request.tabId
          ? await scope.Extractor.getTabById(request.tabId)
          : await scope.Extractor.getActiveTab();
        await scope.JobStore.updateJob(job.id, {
          status: 'in_progress',
          tabId: tab.id,
          tabUrl: tab.url,
        });

        const intent = request.intent;
        let raw = null;
        let normalized = null;
        const url = tab.url;

        if (!intent) {
          throw { code: 'intent', message: 'Send intent is required' };
        }

        await ensureOptionalHostAccess(url);
        if (!sameOrigin(request.url, url)) {
          throw { code: 'tab_changed', message: 'Tab changed since trigger. Please retry.' };
        }

        if (intent === 'selection') {
          raw = await scope.Extractor.extractSelection(tab);
          if (hasSelection(raw)) {
            normalized = scope.ConduitNormalize.normalizeSelection(raw);
          } else {
            throw { code: 'selection_empty', message: 'No text selected to send' };
          }
        } else if (intent === 'sourceExtract') {
          const matches = scope.Extractor
            .detectSources(url)
            .filter((source) => source.id !== 'web');
          const source = matches[0];
          if (!source) {
            throw { code: 'unsupported', message: 'This page is not a supported source' };
          }
          raw = await scope.Extractor.extractSourceById(tab, source.id);
          if (source.id === 'gdoc') {
            if (!raw.docId) {
              throw { code: 'extract', message: 'Google Doc ID not found' };
            }
            normalized = scope.ConduitNormalize.normalizeGDoc(raw);
          } else if (source.id === 'youtube') {
            if (raw.isLive) {
              throw { code: 'extract', message: 'Live YouTube videos are not supported' };
            }
            if (!raw.videoId) {
              throw { code: 'extract', message: 'YouTube video ID not found' };
            }
            if (!raw.transcript || !raw.transcript.trim()) {
              const captionTrackCount =
                typeof raw.captionTrackCount === 'number' ? raw.captionTrackCount : 0;
              const transcriptStatus = raw.transcriptStatus || '';
              const message =
                captionTrackCount === 0
                  ? 'YouTube captions are not available for this video'
                  : 'YouTube transcript could not be retrieved';
              throw {
                code: 'extract',
                message,
                detail: {
                  videoId: raw.videoId || '',
                  captionTrackCount,
                  transcriptStatus,
                },
              };
            }
            normalized = scope.ConduitNormalize.normalizeYouTube(raw);
          } else if (hasConversation(raw)) {
            normalized = scope.ConduitNormalize.normalizeConversation(raw, source.label);
          } else {
            throw { code: 'extract', message: 'Source content not found' };
          }
        } else if (intent === 'pageMain') {
          raw = await scope.Extractor.extractSourceById(tab, 'web');
          if (!raw.content || !raw.content.trim()) {
            throw { code: 'extract', message: 'No readable page content found' };
          }
          normalized = scope.ConduitNormalize.normalizeWebPage(raw);
        } else {
          throw { code: 'intent', message: `Unknown intent: ${intent}` };
        }

        if (!normalized) {
          throw { code: 'extract', message: 'Unable to extract content for this page' };
        }

        const resolvedDestination = await resolveDestination(request.destination, job.id);
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
          requestId: request.requestId || null,
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
