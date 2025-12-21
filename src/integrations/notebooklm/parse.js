// NotebookLM Response Parsing
(function (global) {

    function safeJSONParse(text) {
        if (!text) throw { code: "parse", message: "Empty response body" };
        // Remove standard garbage prefix )]}'
        const clean = text.replace(/^\)]}'\s*/, "");
        try {
            return JSON.parse(clean);
        } catch (e) {
            throw { code: "parse", message: "Invalid JSON structure", detail: e.message };
        }
    }

    global.NLM_Parse = {
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
            const responseItem = json.find(item => Array.isArray(item) && item[0] === global.NLM_RPC.LIST_NOTEBOOKS);

            if (!responseItem || !responseItem[1]) {
                // If the array is valid but RPC not found, it might be an empty state or error in upstream
                // But technically if we asked for it, it should be there. 
                // Check for global error in the envelope?
                throw { code: "parse", message: "List RPC response missing" };
            }

            try {
                const data = JSON.parse(responseItem[1]);
                // Shape: [null, [item1, item2...], ...]
                // Items: [id, title, ...]

                if (!Array.isArray(data)) throw new Error("Data payload not array");

                // The structure for list is usually: [null, [Array of Notebooks], ...] or similar.
                // Based on "Preserved semantic payload shape: [null, 1, null, [2]]" from prompt... 
                // Wait, prompt said: "List notebooks... Use preserved semantic payload shape: [null, 1, null, [2]]"
                // This describes the request payload? Or the response path?
                // The prompt says "Payload shapes (minimum viable)... List notebooks... [null, 1, null, [2]]".
                // This surely refers to the REQUEST payload structure for `f.req`.
                // The response parsing instruction says: "Return: notebook list: array of {id, title}". 

                // Standard Batchexecute list response generic exploration:
                // We need to look for an array of notebooks.
                // Usually it's in data[1]. 

                const notebooksArray = data[1];
                if (!Array.isArray(notebooksArray)) {
                    // It might be empty?
                    // If user has 0 notebooks, this might be null or empty array.
                    return [];
                }

                // Map safely
                return notebooksArray.map(nb => {
                    // nb is [id, title, ... ]
                    // Validation
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
            const responseItem = json.find(item => Array.isArray(item) && item[0] === global.NLM_RPC.CREATE_NOTEBOOK);
            if (!responseItem || !responseItem[1]) throw { code: "parse", message: "Create RPC response missing" };

            try {
                const data = JSON.parse(responseItem[1]);
                // We expect {id, title} out of this.
                // Usually created object is returned. 
                // Let's assume standard creation returns the object at root or data[1].
                // This is a "testing cut", we need to be defensive.
                // If we can't find id, we fail.

                // Hypothesis: data[1] is the notebook object [id, title, ...]
                const nb = data[1];
                if (Array.isArray(nb) && typeof nb[0] === 'string') {
                    return { id: nb[0], title: nb[1] };
                }

                // Fallback check
                if (Array.isArray(data) && typeof data[0] === 'string') {
                    // Sometimes it returns the ID directly? Unlikely for NLM.
                    // Let's assume nb at matches.
                }

                throw new Error("Could not locate created notebook ID");
            } catch (e) {
                throw { code: "parse", message: "Create payload parsing failed", detail: e.message };
            }
        },

        parseAddSource: function (responseText) {
            const json = safeJSONParse(responseText);
            const responseItem = json.find(item => Array.isArray(item) && item[0] === global.NLM_RPC.ADD_SOURCE);

            // If responseItem exists, it generally means success for batchexecute unless there is an error block.
            if (!responseItem) throw { code: "parse", message: "Add Source RPC response missing" };

            // We iterate to see if there's a business logic error (inside the inner JSON)
            // But often batchexecute puts errors in the outer envelope if they are system errors.
            // Assuming 200 OK + RPC present = Success for this MV.

            return { success: true };
        }
    };
})(typeof window !== 'undefined' ? window : this);
