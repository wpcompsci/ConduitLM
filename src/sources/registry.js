// Source Registry
(function (scope) {
  const sources = [];

  function register(source) {
    sources.push(source);
  }

  function list() {
    return sources.slice();
  }

  function getById(id) {
    return sources.find((source) => source.id === id) || null;
  }

  function matchByUrl(url) {
    if (!url) return [];
    return sources.filter((source) => {
      if (typeof source.match === 'function') {
        try {
          return source.match(url);
        } catch (e) {
          return false;
        }
      }
      return false;
    });
  }

  scope.SourceRegistry = {
    register,
    list,
    getById,
    matchByUrl,
  };
})(globalThis);
