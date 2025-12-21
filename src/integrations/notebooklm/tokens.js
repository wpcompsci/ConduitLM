// NotebookLM Token Discovery
(function (global) {
    const TOKENS = {
        AT: null,
        BL: null
    };

    /**
     * Parsing helper that doesn't rely on fixed offsets.
     */
    function extractToken(html, keyPattern, valuePattern) {
        // Look for the reliable patterns NotebookLM uses
        // "SNlM0e":"<token>"
        // "cfb2h":"<token>"
        const regex = new RegExp(`"${keyPattern}":"([^"]+)"`);
        const match = html.match(regex);
        return match ? match[1] : null;
    }

    global.NLM_Tokens = {
        /**
         * Fetches homepage and extracts tokens.
         * Throws 'auth' error if failing.
         */
        fetchTokens: async function () {
            try {
                // If we have them in memory, reusing might be ok for a session, 
                // but for correctness/robustness (volatility), re-fetching or 
                // verifying logic is better. Minding the "Don't store in memory 
                // for correctness" hint in prompt, strictly fetching fresh might be better. 
                // But batchexecute usually allows tokens to live for a session.
                // We will fetch fresh to be safe given the prompt requirements.

                const response = await fetch("https://notebooklm.google.com/", {
                    method: "GET",
                    headers: { "Cache-Control": "no-cache" }
                });

                if (response.status === 401 || response.status === 403 || response.url.includes("accounts.google.com")) {
                    throw { code: "auth", message: "Not signed in to NotebookLM" };
                }

                if (!response.ok) {
                    throw { code: "network", message: `NotebookLM fetch failed: ${response.status}` };
                }

                const text = await response.text();

                // at token: SNlM0e
                const at = extractToken(text, "SNlM0e");
                // bl token: cfb2h
                const bl = extractToken(text, "cfb2h");

                if (!at || !bl) {
                    throw { code: "auth", message: "Could not find auth tokens. Please sign in." };
                }

                return { at, bl };

            } catch (error) {
                if (error.code) throw error;
                throw { code: "network", message: error.message || "Failed to fetch tokens" };
            }
        }
    };
})(typeof window !== 'undefined' ? window : this);
