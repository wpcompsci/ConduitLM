// src/background/router.js
// Background Router
// Loaded via importScripts in main.js

// Expects globalThis.Pipeline to be available

console.log('[ConduitLM] router loaded', Date.now());

browser.runtime.onMessage.addListener((message, _sender) => {
  // Envelope: { ok, data, error }
  const respond = (resultPromise) => {
    return resultPromise
      .then((data) => ({ ok: true, data }))
      .catch((err) => {
        console.error('BG Error:', err);
        return {
          ok: false,
          error: {
            code: err.code || 'unknown',
            message: err.message || 'Unknown error',
            detail: err.detail,
          },
        };
      });
  };

  if (message.type === 'NLM_LIST_NOTEBOOKS') {
    return respond(globalThis.Pipeline.handleListNotebooks());
  }

  if (message.type === 'NLM_SEND') {
    return respond(globalThis.Pipeline.handleSend(message.payload));
  }

  if (message.type === 'SEND_SELECTION_TO_NLM') {
    return respond(
      globalThis.Pipeline.handleSend({
        intent: 'selection',
        destination: message.destination,
      })
    );
  }

  if (message.type === 'SAVE_CONVERSATION') {
    return respond(
      globalThis.Pipeline.handleSend({
        intent: 'chat',
        destination: message.destination || { type: 'create', title: message.data.source },
      })
    );
  }

  // Default handler for unknown messages to prevent hanging
  return Promise.resolve({
    ok: false,
    error: { code: 'unknown', message: `Unknown message type: ${message.type}` },
  });
});
