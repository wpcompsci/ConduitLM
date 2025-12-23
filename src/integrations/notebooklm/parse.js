// NotebookLM Response Parsing
(function (scope) {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function isUuid(value) {
    return typeof value === 'string' && UUID_REGEX.test(value);
  }

  function normalizeResponseText(text) {
    if (!text) throw { code: 'parse', message: 'Empty response body' };
    return text.replace(/^\)]}'\s*/, '');
  }

  function parseEnvelopeItems(responseText) {
    const clean = normalizeResponseText(responseText);
    const lines = clean.split('\n');
    const items = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          items.push(...parsed);
        }
      } catch (e) {
        // Skip non-JSON lines (length prefixes, partials).
      }
    }

    if (items.length === 0) {
      throw { code: 'parse', message: 'No batchexecute envelopes found' };
    }

    return items;
  }

  function extractPayloads(items) {
    const payloads = [];
    for (const item of items) {
      if (!Array.isArray(item)) continue;

      const rpcId = typeof item[1] === 'string' ? item[1] : null;
      const payloadStr = typeof item[2] === 'string' ? item[2] : null;

      if (!payloadStr) continue;

      try {
        const payload = JSON.parse(payloadStr);
        payloads.push({ rpcId, payload, raw: payloadStr });
      } catch (e) {
        // Ignore payloads that do not parse.
      }
    }

    return payloads;
  }

  function extractNotebookList(payload) {
    if (!Array.isArray(payload)) return null;
    const notebookList = payload[0];
    if (!Array.isArray(notebookList)) return null;

    const notebooks = notebookList
      .filter((entry) => Array.isArray(entry) && isUuid(entry[2]) && typeof entry[0] === 'string')
      .filter((entry) => !(entry[5] && entry[5][0] === 3))
      .map((entry) => ({
        id: entry[2],
        title: entry[0].trim() || 'Untitled Notebook',
        emoji: entry[3] || null,
      }));

    return notebooks.length > 0 ? notebooks : null;
  }

  function extractFirstUuid(text) {
    const match = text.match(UUID_REGEX);
    return match ? match[0] : null;
  }

  function findUuidInValue(value, depth) {
    if (depth > 6) return null;
    if (typeof value === 'string') {
      return isUuid(value) ? value : null;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findUuidInValue(item, depth + 1);
        if (found) return found;
      }
    }
    if (value && typeof value === 'object') {
      for (const item of Object.values(value)) {
        const found = findUuidInValue(item, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  function detectErrorPayload(payload) {
    if (!Array.isArray(payload)) return null;
    if (payload.length === 0) return null;

    if (typeof payload[0] === 'string' && (payload[0] === 'er' || payload[0] === 'e')) {
      return payload;
    }
    if (Array.isArray(payload[0])) {
      const node = payload[0];
      if (typeof node[0] === 'string' && (node[0] === 'er' || node[0] === 'e')) {
        return node;
      }
    }
    return null;
  }

  function summarizePayloads(payloads) {
    return payloads.map((payload) => ({
      rpcId: payload.rpcId,
      payloadType: Array.isArray(payload.payload) ? 'array' : typeof payload.payload,
    }));
  }

  scope.NLM_Parse = {
    parseListNotebooks: function (responseText, context) {
      const items = parseEnvelopeItems(responseText);
      const payloads = extractPayloads(items);

      let notebooks = null;
      const direct = payloads.find((p) => p.rpcId === scope.NLM_RPC.LIST_NOTEBOOKS);
      if (direct) {
        notebooks = extractNotebookList(direct.payload);
      }

      if (!notebooks) {
        for (const candidate of payloads) {
          const list = extractNotebookList(candidate.payload);
          if (list) {
            notebooks = list;
            break;
          }
        }
      }

      if (!notebooks) {
        throw {
          code: 'parse',
          message: 'Notebook list not found in response',
          detail: {
            tabUrl: context && context.tabUrl ? context.tabUrl : 'unknown',
            envelopeCount: items.length,
            payloadCount: payloads.length,
            payloadSummary: summarizePayloads(payloads),
            responsePreview: responseText.slice(0, 400),
          },
        };
      }

      return notebooks;
    },

    parseCreateNotebook: function (responseText, title) {
      const items = parseEnvelopeItems(responseText);
      const payloads = extractPayloads(items);

      for (const payload of payloads) {
        const errorNode = detectErrorPayload(payload.payload);
        if (errorNode) {
          throw {
            code: 'parse',
            message: 'Create notebook returned error response',
            detail: {
              errorNode,
              responsePreview: responseText.slice(0, 400),
            },
          };
        }
      }

      let id = extractFirstUuid(responseText);
      if (!id) {
        for (const payload of payloads) {
          id = findUuidInValue(payload.payload, 0);
          if (id) break;
          if (payload.raw) {
            const rawMatch = extractFirstUuid(payload.raw);
            if (rawMatch) {
              id = rawMatch;
              break;
            }
          }
        }
      }

      if (!id) {
        throw {
          code: 'parse',
          message: 'Create response did not include notebook ID',
          detail: {
            envelopeCount: items.length,
            payloadCount: payloads.length,
            payloadSummary: summarizePayloads(payloads),
            responsePreview: responseText.slice(0, 400),
          },
        };
      }

      return { id, title: title || 'New Notebook' };
    },

    parseAddSource: function (responseText, context) {
      const items = parseEnvelopeItems(responseText);
      const payloads = extractPayloads(items);

      for (const payload of payloads) {
        const errorNode = detectErrorPayload(payload.payload);
        if (errorNode) {
          throw {
            code: 'parse',
            message: 'Add Source returned error response',
            detail: {
              tabUrl: context && context.tabUrl ? context.tabUrl : 'unknown',
              errorNode,
              responsePreview: responseText.slice(0, 400),
            },
          };
        }
      }

      return { success: true };
    },
  };
})(globalThis);
