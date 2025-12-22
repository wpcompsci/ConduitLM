// Gemini Source
(function (scope) {
  function match(url) {
    try {
      const host = new URL(url).hostname;
      return host === 'gemini.google.com';
    } catch (e) {
      return false;
    }
  }

  function extract() {
    const messages = [];
    const container = document.querySelector('div.conversation-container');
    if (container) {
      const turns = container.querySelectorAll('user-query, model-response');
      turns.forEach((turn) => {
        if (turn.tagName.toLowerCase() === 'user-query') {
          const contentEl = turn.querySelector('div.query-text');
          if (contentEl && contentEl.innerText.trim()) {
            messages.push({ role: 'user', content: contentEl.innerText.trim() });
          }
        } else if (turn.tagName.toLowerCase() === 'model-response') {
          const contentEl = turn.querySelector('div.markdown');
          if (contentEl && contentEl.innerText.trim()) {
            messages.push({ role: 'model', content: contentEl.innerText.trim() });
          }
        }
      });
    }

    const titleEl =
      document.querySelector('.conversation-title') || document.querySelector('.title');
    const rawTitle = titleEl ? titleEl.innerText.trim() : document.title || 'Gemini Chat';
    const title = rawTitle.replace(' - Gemini', '').trim() || 'Gemini Chat';

    return {
      title,
      url: location.href,
      messages,
    };
  }

  scope.SourceRegistry.register({
    id: 'gemini',
    label: 'Gemini Conversation',
    match,
    extract,
  });
})(globalThis);
