// Extraction Helpers
(function (scope) {
  function isRestrictedUrl(url) {
    return !url || url.startsWith('about:') || url.startsWith('moz-extension:');
  }

  async function getActiveTab() {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      throw { code: 'unknown', message: 'No active tab found' };
    }
    const tab = tabs[0];
    if (isRestrictedUrl(tab.url)) {
      throw { code: 'permission', message: 'Cannot extract from restricted page' };
    }
    return tab;
  }

  async function getTabById(tabId) {
    try {
      const tab = await browser.tabs.get(tabId);
      if (!tab || !tab.url) {
        throw { code: 'tab_missing', message: 'Tab not available' };
      }
      if (isRestrictedUrl(tab.url)) {
        throw { code: 'permission', message: 'Cannot extract from restricted page' };
      }
      return tab;
    } catch (error) {
      if (error && error.code) throw error;
      throw { code: 'tab_missing', message: 'Tab not available' };
    }
  }

  async function executeInTab(tabId, func, args) {
    try {
      const results = await browser.scripting.executeScript({
        target: { tabId },
        func,
        args: args || [],
      });

      const lastError = browser.runtime.lastError;
      if (lastError) {
        throw new Error(lastError.message || 'Failed to execute script');
      }

      if (!results || results.length === 0) {
        throw new Error('Injection returned no results');
      }

      return results[0].result;
    } catch (error) {
      const message = error && error.message ? error.message : 'Failed to execute script';
      if (message.includes('Missing host permission')) {
        throw { code: 'permission', message: 'Missing host permission for this page' };
      }
      throw { code: 'injection', message };
    }
  }

  function selectionExtractor() {
    const selection = window.getSelection ? window.getSelection().toString() : '';
    return {
      selection: selection || '',
      title: document.title || 'Selected Text',
      url: location.href,
    };
  }

  scope.Extractor = {
    getActiveTab,
    getTabById,
    extractSelection: async function (tab) {
      return await executeInTab(tab.id, selectionExtractor, []);
    },
    extractSourceById: async function (tab, sourceId) {
      const source = scope.SourceRegistry.getById(sourceId);
      if (!source) {
        throw { code: 'unsupported', message: `Unsupported source: ${sourceId}` };
      }
      return await executeInTab(tab.id, source.extract, []);
    },
    detectSources: function (url) {
      return scope.SourceRegistry.matchByUrl(url);
    },
  };
})(globalThis);
