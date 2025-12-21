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
        // Use globalThis to access globally registered Pipeline
        return respond(globalThis.Pipeline.handleListNotebooks());
    }

    if (message.type === "SEND_SELECTION_TO_NLM") {
        return respond(globalThis.Pipeline.handleIngest(message.destination));
    }

    // Explicitly return false/undefined for unknown messages
});

console.log("ConduitLM Background Initialized");
