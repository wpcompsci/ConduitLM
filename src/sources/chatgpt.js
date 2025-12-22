// ChatGPT Source
(function (scope) {
  function match(url) {
    try {
      const host = new URL(url).hostname;
      return host === 'chat.openai.com' || host === 'chatgpt.com';
    } catch (e) {
      return false;
    }
  }

  function extract() {
    const messages = [];
    const turnElements = document.querySelectorAll('article[data-turn-id]');

    turnElements.forEach((turn) => {
      const roleEl = turn.querySelector('[data-message-author-role]');
      const contentEl =
        turn.querySelector('.whitespace-pre-wrap') || turn.querySelector('.markdown');

      if (!roleEl || !contentEl) return;

      messages.push({
        role: roleEl.getAttribute('data-message-author-role'),
        content: contentEl.innerText.trim(),
      });
    });

    const rawTitle = document.title || 'ChatGPT Chat';
    const title = rawTitle.replace(' - ChatGPT', '').trim() || 'ChatGPT Chat';

    return {
      title,
      url: location.href,
      messages,
    };
  }

  scope.SourceRegistry.register({
    id: 'chatgpt',
    label: 'ChatGPT Conversation',
    match,
    extract,
  });
})(globalThis);
