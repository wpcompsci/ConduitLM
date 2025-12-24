// Context Menu Trigger Registration
(function (scope) {
  const MENU_SELECTION_ID = 'conduit_send_selection';
  const MENU_PAGE_ID = 'conduit_send_page';

  function isRestrictedUrl(url) {
    return !url || url.startsWith('about:') || url.startsWith('moz-extension:');
  }

  function isSourceOnlyHost(url) {
    return (
      scope.ConduitHosts &&
      typeof scope.ConduitHosts.isSourceExtractHost === 'function' &&
      scope.ConduitHosts.isSourceExtractHost(url)
    );
  }

  function buildTrigger(intent, tab) {
    return {
      triggerType: scope.ConduitTriggers.TRIGGER_TYPES.contextMenu,
      intent,
      tabId: tab.id,
      url: tab.url,
      requestId: scope.ConduitTriggers.createRequestId(),
    };
  }

  async function createMenus() {
    try {
      await browser.menus.removeAll();
      browser.menus.create({
        id: MENU_SELECTION_ID,
        title: 'ConduitLM: Send selection to NotebookLM',
        contexts: ['selection'],
      });
      browser.menus.create({
        id: MENU_PAGE_ID,
        title: 'ConduitLM: Send page content to NotebookLM',
        contexts: ['page'],
      });
    } catch (error) {
      console.error('[ConduitLM] Failed to create context menus', error);
    }
  }

  async function openNotice(error) {
    try {
      await scope.ConduitTriggerStore.setNotice(error);
    } catch (storeError) {
      console.error('[ConduitLM] Failed to store notice', storeError);
    }

    try {
      if (browser.action && typeof browser.action.openPopup === 'function') {
        await browser.action.openPopup();
        return;
      }
    } catch (popupError) {
      // Fall through to window fallback.
    }

    try {
      const popupUrl = browser.runtime.getURL('ui/popup/popup.html');
      await browser.windows.create({
        url: popupUrl,
        type: 'popup',
        width: 360,
        height: 560,
        focused: true,
      });
    } catch (windowError) {
      console.error('[ConduitLM] Unable to surface notice', windowError);
    }
  }

  browser.runtime.onInstalled.addListener(() => {
    createMenus();
  });

  browser.runtime.onStartup.addListener(() => {
    createMenus();
  });

  browser.menus.onShown.addListener((info, tab) => {
    try {
      const shouldDisable =
        !tab || isRestrictedUrl(tab.url) || isSourceOnlyHost(tab.url);
      browser.menus.update(MENU_SELECTION_ID, { enabled: !shouldDisable });
      browser.menus.update(MENU_PAGE_ID, { enabled: !shouldDisable });
      browser.menus.refresh();
    } catch (error) {
      console.error('[ConduitLM] Failed to update context menus', error);
    }
  });

  browser.menus.onClicked.addListener((info, tab) => {
    try {
      if (!tab || typeof tab.id !== 'number' || !tab.url) {
        throw { code: 'tab_missing', message: 'Active tab not available for context menu' };
      }
      if (isRestrictedUrl(tab.url)) {
        openNotice({
          code: 'permission',
          message: 'Cannot send from this page. Open a standard webpage to continue.',
        });
        return;
      }
      if (isSourceOnlyHost(tab.url)) {
        openNotice({
          code: 'intent_unavailable',
          message:
            'This site only supports source extraction. Use the in-page button or toolbar.',
        });
        return;
      }

      let intent = null;
      if (info.menuItemId === MENU_SELECTION_ID) {
        intent = scope.ConduitTriggers.INTENTS.selection;
      } else if (info.menuItemId === MENU_PAGE_ID) {
        intent = scope.ConduitTriggers.INTENTS.pageMain;
      } else {
        return;
      }

      const trigger = buildTrigger(intent, tab);
      scope.ConduitTriggerFlow
        .handleTriggerMessage({ trigger }, { tab })
        .catch((error) => {
          console.error('[ConduitLM] Context menu trigger failed', error);
        });
    } catch (error) {
      console.error('[ConduitLM] Context menu trigger failed', error);
    }
  });
})(globalThis);
