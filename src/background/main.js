// Background Main (Router)

// Note: Requires integrations and pipeline to be loaded first via manifest scripts array.

browser.runtime.onMessage.addListener((message, sender) => {
    // Envelope: { ok, data, error }
    const respond = (resultPromise) => {
        return resultPromise
            .then(data => ({ ok: true, data }))
            .catch(err => {
                console.error("BG Error:", err);
                return {
                    ok: false,
                    error: {
                        code: err.code || "unknown",
                        message: err.message || "Unknown error",
                        detail: err.detail
                    }
                };
            });
    };

    if (message.type === "NLM_LIST_NOTEBOOKS") {
        return respond(global.Pipeline.handleListNotebooks());
    }

    if (message.type === "SEND_SELECTION_TO_NLM") {
        // message.destination: { type: 'select'|'create', id?, title? }
        return respond(global.Pipeline.handleIngest(message.destination));
    }

    // Explicitly return false/undefined for unknown messages to ignore them
    // But protocol says "one response per message"... if it's OUR message.
    // We should differentiate namespace or just ignore unknown.
    // If we return a Promise, browser waits. If we return undefined, it closes.
    // For unknown types, we return undefined (synchronously).
});

// State restoration or other sync logic can go here if needed.
console.log("ConduitLM Background Initialized");
