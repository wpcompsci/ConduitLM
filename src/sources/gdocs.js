// Google Docs Source
(function (scope) {
  function match(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname === 'docs.google.com' && parsed.pathname.includes('/document/');
    } catch (e) {
      return false;
    }
  }

  function extract() {
    const url = location.href;
    const match = url.match(/document\/d\/([a-zA-Z0-9_-]+)/);
    const docId = match && match[1] ? match[1] : null;

    const titleInput = document.querySelector('input.docs-title-input');
    const rawTitle = titleInput ? titleInput.value.trim() : document.title || 'Google Doc';
    const title = rawTitle.replace(' - Google Docs', '').trim() || 'Google Doc';

    return {
      title,
      url,
      docId,
    };
  }

  scope.SourceRegistry.register({
    id: 'gdoc',
    label: 'Google Doc',
    match,
    extract,
  });
})(globalThis);
