// Shared Host Definitions
(function (scope) {
  const NOTEBOOKLM_ORIGIN = 'https://notebooklm.google.com/*';
  const CHATGPT_ORIGIN = 'https://chat.openai.com/*';
  const CHATGPT_ALT_ORIGIN = 'https://chatgpt.com/*';
  const GEMINI_ORIGIN = 'https://gemini.google.com/*';
  const GDOCS_ORIGIN = 'https://docs.google.com/document/*';

  function getOptionalOrigin(url) {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      const host = parsed.hostname;
      if (host === 'chat.openai.com') return CHATGPT_ORIGIN;
      if (host === 'chatgpt.com') return CHATGPT_ALT_ORIGIN;
      if (host === 'gemini.google.com') return GEMINI_ORIGIN;
      if (host === 'docs.google.com' && parsed.pathname.startsWith('/document/')) {
        return GDOCS_ORIGIN;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  function isSupportedHost(url) {
    return Boolean(getOptionalOrigin(url));
  }

  function isSourceExtractHost(url) {
    const origin = getOptionalOrigin(url);
    return (
      origin === CHATGPT_ORIGIN ||
      origin === CHATGPT_ALT_ORIGIN ||
      origin === GEMINI_ORIGIN ||
      origin === GDOCS_ORIGIN
    );
  }

  scope.ConduitHosts = {
    NOTEBOOKLM_ORIGIN,
    CHATGPT_ORIGIN,
    CHATGPT_ALT_ORIGIN,
    GEMINI_ORIGIN,
    GDOCS_ORIGIN,
    getOptionalOrigin,
    isSupportedHost,
    isSourceExtractHost,
  };
})(globalThis);
