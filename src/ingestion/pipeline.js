// Ingestion Pipeline
(function (scope) {

    // Helper to extract selection from active tab
    async function getSelectionFromActiveTab() {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tabs || tabs.length === 0) {
            throw { code: "unknown", message: "No active tab found" };
        }
        const activeTab = tabs[0];

        // Check for restricted URLs (about:, chrome:, etc)
        if (!activeTab.url || activeTab.url.startsWith("about:") || activeTab.url.startsWith("moz-extension:")) {
            throw { code: "permission", message: "Cannot capture from restricted page type" };
        }

        try {
            const results = await browser.scripting.executeScript({
                target: { tabId: activeTab.id },
                func: () => {
                    return window.getSelection() ? window.getSelection().toString() : "";
                }
            });

            if (!results || results.length === 0) {
                throw new Error("Injection returned no results");
            }

            const content = results[0].result;
            return {
                content: content || "",
                title: activeTab.title || "Untitled Page",
                url: activeTab.url
            };

        } catch (e) {
            console.error("Injection error:", e);
            if (e.message && e.message.includes("Missing host permission")) {
                throw { code: "permission", message: "Extension needs permission to access this page" };
            }
            throw { code: "injection", message: "Failed to capture selection: " + e.message };
        }
    }

    scope.Pipeline = {
        handleListNotebooks: async function () {
            try {
                return await scope.NLM_Client.listNotebooks();
            } catch (e) {
                throw e.code ? e : { code: "notebook_list", message: e.message || "Failed to list notebooks" };
            }
        },

        handleIngest: async function (destination) {
            // 1. Capture Selection
            const selectionData = await getSelectionFromActiveTab();
            if (!selectionData.content || selectionData.content.trim().length === 0) {
                throw { code: "selection_empty", message: "No text selected to send" };
            }

            // 2. Resolve Notebook ID (Create if needed)
            let notebookId = destination.id;
            let notebookTitle = "Existing Notebook";

            if (destination.type === 'create') {
                try {
                    const created = await scope.NLM_Client.createNotebook(destination.title);
                    notebookId = created.id;
                    notebookTitle = created.title;
                } catch (e) {
                    throw e.code ? e : { code: "notebook_create", message: e.message || "Failed to create notebook" };
                }
            }

            // 3. Add Source
            try {
                await scope.NLM_Client.addTextSource(notebookId, selectionData.title, selectionData.content);
                return {
                    status: "ingested",
                    notebookId: notebookId,
                    notebookTitle: notebookTitle || destination.title,
                    sourceTitle: selectionData.title
                };
            } catch (e) {
                throw e.code ? e : { code: "source_ingest", message: e.message || "Failed to add text source" };
            }
        },

        handleSaveConversation: async function (data) {
            const { conversation, source, notebookId } = data; // notebookId can be optional

            // Let's create a new notebook with the title 'source' (e.g. "[ChatGPT] New chat")
            try {
                // If it's a doc import
                const isGDocImport = conversation.length === 1 && conversation[0].role === 'document';

                // Use formatters
                let content = "";
                if (isGDocImport) {
                    throw { code: "not_implemented", message: "GDoc import not fully implemented in pipeline yet." };
                } else {
                    // scope.sourceFormatters must be loaded
                    if (!scope.sourceFormatters) throw { code: "dependency", message: "Source formatters not loaded" };
                    content = scope.sourceFormatters.md(source, conversation);
                }

                // Create Notebook
                const notebook = await scope.NLM_Client.createNotebook(source);

                // Add Source
                await scope.NLM_Client.addTextSource(notebook.id, source, content);

                return {
                    status: "saved_conversation",
                    notebookId: notebook.id,
                    notebookTitle: notebook.title,
                    sourceTitle: source
                };
            } catch (e) {
                console.error("Pipeline Save Error:", e);
                throw e.code ? e : { code: "save_conversation", message: e.message || "Failed to save conversation" };
            }
        }
    };
})(globalThis);
