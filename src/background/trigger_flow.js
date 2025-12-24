// Background Trigger Flow
(function (scope) {
  function isRestrictedUrl(url) {
    return !url || url.startsWith('about:') || url.startsWith('moz-extension:');
  }

  async function ensureTabContext(trigger) {
    try {
      const tab = await browser.tabs.get(trigger.tabId);
      if (!tab || !tab.url) {
        throw { code: 'tab_missing', message: 'Active tab not available' };
      }
      if (isRestrictedUrl(tab.url)) {
        throw { code: 'permission', message: 'Cannot access restricted page' };
      }
      return tab;
    } catch (error) {
      if (error && error.code) throw error;
      throw { code: 'tab_missing', message: 'Active tab not available' };
    }
  }

  async function openPopup() {
    if (!browser.action || typeof browser.action.openPopup !== 'function') {
      return false;
    }
    try {
      await browser.action.openPopup();
      return true;
    } catch (error) {
      return false;
    }
  }

  async function openFallbackWindow() {
    try {
      const popupUrl = browser.runtime.getURL('ui/popup/popup.html');
      await browser.windows.create({
        url: popupUrl,
        type: 'popup',
        width: 360,
        height: 560,
        focused: true,
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async function openTriggerUi() {
    const opened = await openPopup();
    if (opened) return true;
    return await openFallbackWindow();
  }

  async function queueTrigger(trigger) {
    await scope.ConduitTriggerStore.sweepStale();
    try {
      await ensureTabContext(trigger);
    } catch (error) {
      await scope.ConduitTriggerStore.setNotice(error);
      await openTriggerUi();
      throw error;
    }

    await scope.ConduitTriggerStore.addPending(trigger);
    const opened = await openTriggerUi();
    if (!opened) {
      const error = {
        code: 'popup',
        message: 'Unable to open ConduitLM popup. Use the toolbar button to continue.',
      };
      await scope.ConduitTriggerStore.setNotice(error);
      throw error;
    }

    return { status: 'queued', requestId: trigger.requestId };
  }

  async function finalizeTrigger(trigger, destination) {
    await scope.ConduitTriggerStore.sweepStale();
    await scope.ConduitTriggerStore.removePending(trigger.requestId);
    return await scope.Pipeline.handleSend({
      intent: trigger.intent,
      destination,
      tabId: trigger.tabId,
      url: trigger.url,
      requestId: trigger.requestId,
      triggerType: trigger.triggerType,
    });
  }

  async function normalizeTriggerMessage(message, sender) {
    if (!message || !message.trigger) {
      throw { code: 'trigger', message: 'Missing trigger payload' };
    }

    const triggerInput = Object.assign({}, message.trigger);
    const senderTab = sender && sender.tab ? sender.tab : null;
    if (senderTab) {
      if (triggerInput.tabId == null) triggerInput.tabId = senderTab.id;
      if (!triggerInput.url) triggerInput.url = senderTab.url;
    }

    if (triggerInput.tabId == null || !triggerInput.url) {
      const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
      const activeTab = activeTabs && activeTabs.length > 0 ? activeTabs[0] : null;
      if (activeTab) {
        if (triggerInput.tabId == null) triggerInput.tabId = activeTab.id;
        if (!triggerInput.url) triggerInput.url = activeTab.url;
      }
    }

    return scope.ConduitTriggers.normalizeTrigger(triggerInput);
  }

  async function handleTriggerMessage(message, sender) {
    const trigger = await normalizeTriggerMessage(message, sender);
    if (message.destination) {
      return await finalizeTrigger(trigger, message.destination);
    }
    return await queueTrigger(trigger);
  }

  scope.ConduitTriggerFlow = {
    handleTriggerMessage,
    queueTrigger,
    finalizeTrigger,
  };
})(globalThis);
