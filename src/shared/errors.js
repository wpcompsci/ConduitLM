// Shared Error Helpers
(function (scope) {
  function makeError(code, message, detail) {
    const err = { code, message };
    if (detail !== undefined) err.detail = detail;
    return err;
  }

  function normalizeError(error, fallbackCode, fallbackMessage) {
    if (!error) return makeError(fallbackCode, fallbackMessage);
    if (error.code && error.message) return error;
    return makeError(
      fallbackCode,
      error.message || fallbackMessage,
      error.detail || String(error)
    );
  }

  scope.ConduitErrors = {
    makeError,
    normalizeError,
  };
})(globalThis);
