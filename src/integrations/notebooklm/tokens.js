// src/integrations/notebooklm/tokens.js
// NotebookLM Token Discovery
(function (scope) {
  function extractToken(html, keyPattern) {
    const regex = new RegExp(`"${keyPattern}":"([^"]+)"`);
    const match = regex.exec(html);
    return match ? match[1] : null;
  }

  scope.NLM_Tokens = {
    fetchTokens: async function () {
      try {
        const response = await fetch('https://notebooklm.google.com/', {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' },
          redirect: 'error',
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
        const at = extractToken(text, 'SNlM0e');
        const bl = extractToken(text, 'cfb2h');

        if (!at || !bl) {
          throw { code: 'auth', message: 'Could not find auth tokens. Please sign in.' };
        }

        return { at, bl };
      } catch (error) {
        if (error && error.code) throw error;
        throw { code: 'network', message: error.message || 'Failed to fetch tokens' };
      }
    },
  };
})(globalThis);
