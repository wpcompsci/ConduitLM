// Gemini In-Page Trigger Loader
(function (scope) {
  if (scope.ConduitInPage && typeof scope.ConduitInPage.init === 'function') {
    scope.ConduitInPage.init();
  }
})(globalThis);
