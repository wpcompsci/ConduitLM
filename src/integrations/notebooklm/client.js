// NotebookLM Client
(function (scope) {
  const HOST_PATTERN = 'https://notebooklm.google.com/*';

  async function ensurePermission() {
    const has = await browser.permissions.contains({
      origins: [HOST_PATTERN],
    });
    if (!has) {
      throw {
        code: 'permission',
        message: 'NotebookLM permission not granted. Enable access in the popup.',
      };
    }
  }

  function buildTextSourcePayload(title, content) {
    const textSource = [null, [title, content], null, 2, null, null, null, null, null, null, 1];
    return [[textSource], null, [2]];
  }

  function buildGDocSourcePayload(docId, title) {
    const docSourceData = [docId, 'application/vnd.google-apps.document', 1, title];
    const docSource = [docSourceData, null, null, null, null, null, null, null, null, null, 1];
    const additionalParam = [1, null, null, null, null, null, null, null, null, null, [1]];
    return [[docSource], null, [2], additionalParam];
  }

  scope.NLM_Client = {
    listNotebooks: async function () {
      await ensurePermission();
      const tokens = await scope.NLM_Tokens.fetchTokens();
      const payload = [null, 1, null, [2]];
      const raw = await scope.NLM_Batch.execute(scope.NLM_RPC.LIST_NOTEBOOKS, payload, tokens, '/');
      return scope.NLM_Parse.parseListNotebooks(raw, { tabUrl: 'background' });
    },

    createNotebook: async function (title) {
      await ensurePermission();
      const tokens = await scope.NLM_Tokens.fetchTokens();
      const payload = [title];
      const raw = await scope.NLM_Batch.execute(scope.NLM_RPC.CREATE_NOTEBOOK, payload, tokens, '/');
      return scope.NLM_Parse.parseCreateNotebook(raw, title);
    },

    addTextSource: async function (notebookId, title, content) {
      await ensurePermission();
      const tokens = await scope.NLM_Tokens.fetchTokens();
      const payload = buildTextSourcePayload(title, content);
      payload[1] = notebookId;
      const sourcePath = `/notebook/${notebookId}`;
      const raw = await scope.NLM_Batch.execute(
        scope.NLM_RPC.ADD_TEXT_SOURCE,
        payload,
        tokens,
        sourcePath
      );
      return scope.NLM_Parse.parseAddSource(raw, { tabUrl: sourcePath });
    },

    addGDocSource: async function (notebookId, docId, title) {
      await ensurePermission();
      const tokens = await scope.NLM_Tokens.fetchTokens();
      const payload = buildGDocSourcePayload(docId, title);
      payload[1] = notebookId;
      const sourcePath = `/notebook/${notebookId}`;
      const raw = await scope.NLM_Batch.execute(
        scope.NLM_RPC.ADD_TEXT_SOURCE,
        payload,
        tokens,
        sourcePath
      );
      return scope.NLM_Parse.parseAddSource(raw, { tabUrl: sourcePath });
    },
  };
})(globalThis);
