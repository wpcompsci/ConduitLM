// Shared Trigger Helpers
(function (scope) {
  const TRIGGER_TYPES = Object.freeze({
    toolbar: 'toolbar',
    inPage: 'inPage',
    contextMenu: 'contextMenu',
  });

  const INTENTS = Object.freeze({
    selection: 'selection',
    sourceExtract: 'sourceExtract',
    pageMain: 'pageMain',
  });

  function isValidTriggerType(value) {
    return Object.prototype.hasOwnProperty.call(TRIGGER_TYPES, value);
  }

  function isValidIntent(value) {
    return Object.prototype.hasOwnProperty.call(INTENTS, value);
  }

  function createRequestId() {
    if (scope.crypto && typeof scope.crypto.randomUUID === 'function') {
      return `req_${scope.crypto.randomUUID()}`;
    }
    const rand = Math.floor(Math.random() * 900000 + 100000);
    return `req_${Date.now()}_${rand}`;
  }

  function normalizeTrigger(input, overrides) {
    const data = Object.assign({}, input || {}, overrides || {});
    const triggerType = data.triggerType;
    const intent = data.intent;
    const tabId = data.tabId;
    const url = data.url;
    const requestId = data.requestId || createRequestId();

    if (!isValidTriggerType(triggerType)) {
      throw { code: 'trigger', message: `Invalid triggerType: ${triggerType}` };
    }
    if (!isValidIntent(intent)) {
      throw { code: 'trigger', message: `Invalid intent: ${intent}` };
    }
    if (typeof tabId !== 'number') {
      throw { code: 'trigger', message: 'Missing tabId for trigger' };
    }
    if (!url) {
      throw { code: 'trigger', message: 'Missing url for trigger' };
    }

    return { triggerType, intent, tabId, url, requestId };
  }

  scope.ConduitTriggers = {
    TRIGGER_TYPES,
    INTENTS,
    isValidTriggerType,
    isValidIntent,
    createRequestId,
    normalizeTrigger,
  };
})(globalThis);
