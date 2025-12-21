```javascript
// NotebookLM Response Parsing
(function (scope) {

    function safeJSONParse(text) {
        if (!text) throw { code: "parse", message: "Empty response body" };
        const clean = text.replace(/^\)]}'\s*/, "");
        
        // Batchexecute often includes length prefixes or multiple chunks.
        // We look for the first line that parses into a standard envelope Array.
        const lines = clean.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                    return parsed;
                }
            } catch (e) {
                // Ignore lines that aren't valid JSON (like partials)
                // or continue if it's valid JSON but not an array (like a length prefix)
            }
        }
        
        throw { code: "parse", message: "No valid JSON array found in response" };
    }

    scope.NLM_Parse = {
        /**
         * Parses and validates Batchexecute response.
         * Expects envelope -> payload -> data.
         */
        parseListNotebooks: function (responseText) {
            const json = safeJSONParse(responseText);

            // Envelope check
            // [ ["wXbhsf", "<payload>", null, ... ] ... ]
            if (!Array.isArray(json)) throw { code: "parse", message: "Root not array" };

            // Find the list RPC response
            const responseItem = json.find(item => Array.isArray(item) && item[0] === scope.NLM_RPC.LIST_NOTEBOOKS);

            if (!responseItem || !responseItem[1]) {
                throw { code: "parse", message: "List RPC response missing" };
            }

            try {
                const data = JSON.parse(responseItem[1]);

                if (!Array.isArray(data)) throw new Error("Data payload not array");

                const notebooksArray = data[1];
                if (!Array.isArray(notebooksArray)) {
                    return [];
                }

                // Map safely
                return notebooksArray.map(nb => {
                    if (!Array.isArray(nb) || typeof nb[0] !== 'string') return null;
                    return {
                        id: nb[0],
                        title: nb[1] || "Untitled Notebook"
                    };
                }).filter(Boolean);

            } catch (e) {
                throw { code: "parse", message: "List payload parsing failed", detail: e.message };
            }
        },

        parseCreateNotebook: function (responseText) {
            const json = safeJSONParse(responseText);
            const responseItem = json.find(item => Array.isArray(item) && item[0] === scope.NLM_RPC.CREATE_NOTEBOOK);
            if (!responseItem || !responseItem[1]) throw { code: "parse", message: "Create RPC response missing" };

            try {
                const data = JSON.parse(responseItem[1]);
                const nb = data[1];
                if (Array.isArray(nb) && typeof nb[0] === 'string') {
                    return { id: nb[0], title: nb[1] };
                }

                throw new Error("Could not locate created notebook ID");
            } catch (e) {
                throw { code: "parse", message: "Create payload parsing failed", detail: e.message };
            }
        },

        parseAddSource: function (responseText) {
            const json = safeJSONParse(responseText);
            const responseItem = json.find(item => Array.isArray(item) && item[0] === scope.NLM_RPC.ADD_SOURCE);

            if (!responseItem) throw { code: "parse", message: "Add Source RPC response missing" };

            return { success: true };
        }
    };
})(globalThis);
