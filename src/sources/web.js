// Generic Web Page Source
(function (scope) {
  function match(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  function extract() {
    function isNonTrivial(text) {
      return text && text.trim().length > 200;
    }

    function cleanText(text) {
      return text.replace(/\s+\n/g, '\n').trim();
    }

    function isIgnoredElement(el) {
      if (!el || !el.closest) return false;
      return Boolean(el.closest('nav, footer, aside, header'));
    }

    const title = document.title || 'Web Page';
    const url = location.href;

    const article = document.querySelector('article');
    if (article && !isIgnoredElement(article)) {
      const text = cleanText(article.innerText || '');
      if (isNonTrivial(text)) {
        return { title, url, content: text, metadata: { source: 'article' } };
      }
    }

    const main = document.querySelector('main');
    if (main && !isIgnoredElement(main)) {
      const text = cleanText(main.innerText || '');
      if (isNonTrivial(text)) {
        return { title, url, content: text, metadata: { source: 'main' } };
      }
    }

    const candidates = Array.from(document.querySelectorAll('article, main, section, div')).filter(
      (el) => !isIgnoredElement(el)
    );
    let best = null;
    let bestLength = 0;

    candidates.forEach((el) => {
      const text = cleanText(el.innerText || '');
      if (text.length > bestLength) {
        bestLength = text.length;
        best = text;
      }
    });

    return {
      title,
      url,
      content: best ? best : '',
      metadata: { source: 'largest-container' },
    };
  }

  scope.SourceRegistry.register({
    id: 'web',
    label: 'Web Page',
    match,
    extract,
  });
})(globalThis);
