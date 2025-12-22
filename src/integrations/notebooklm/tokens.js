// src/integrations/notebooklm/tokens.js
// NotebookLM Token Discovery
(function (scope) {
  /**
   * Parsing helper that doesn't rely on fixed offsets.
   */
  function extractToken(html, keyPattern) {
    // Look for the reliable patterns NotebookLM uses
    // "SNlM0e":"<token>"
    // "cfb2h":"<token>"
    const regex = new RegExp(`"${keyPattern}":"([^"]+)"`);
    const match = html.match(regex);
    return match ? match[1] : null;
  }

  scope.NLM_Tokens = {
    /**
     * Fetches homepage and extracts tokens.
     * Throws 'auth' error if failing.
     */
    fetchTokens: async function () {
      try {
        const response = await fetch('https://notebooklm.google.com/', {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' },
        });

        if (
          response.status === 401 ||
          response.status === 403 ||
          response.url.includes('accounts.google.com')
        ) {
          throw { code: 'auth', message: 'Not signed in to NotebookLM' };
        }

        if (!response.ok) {
          throw { code: 'network', message: `NotebookLM fetch failed: ${response.status}` };
        }

        const text = await response.text();

        // at token: SNlM0e
        const at = extractToken(text, 'SNlM0e');
        // bl token: cfb2h
        const bl = extractToken(text, 'cfb2h');

        if (!at || !bl) {
          throw { code: 'auth', message: 'Could not find auth tokens. Please sign in.' };
        }

        return { at, bl };
      } catch (error) {
        if (error.code) throw error;
        throw { code: 'network', message: error.message || 'Failed to fetch tokens' };
      }
    },
  };
})(globalThis);
