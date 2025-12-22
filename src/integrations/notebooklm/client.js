// NotebookLM Client
(function (scope) {
  const HOST_ORIGIN = 'https://notebooklm.google.com';
  const ENDPOINT = `${HOST_ORIGIN}/_/LabsTailwindUi/data/batchexecute`;

  async function checkPermission() {
    // Safe check using browser namespace (always available in MV3 background)
    const has = await browser.permissions.contains({
      origins: ['https://notebooklm.google.com/*'],
    });
    if (!has) {
      throw { code: 'permission', message: 'Missing host permission for NotebookLM' };
    }
  }

  async function executeRequest(rpcId, payloadInner, tokens) {
    await checkPermission();

    const reqId = Math.floor(Math.random() * 100000);

    // Construct freq
    const freq = JSON.stringify([[[rpcId, JSON.stringify(payloadInner), null, 'generic']]]);

    const params = new URLSearchParams();
    params.append('rpcids', rpcId);
    params.append('source-path', '/');
    params.append('bl', tokens.bl);
    params.append('_reqid', reqId);
    params.append('rt', 'c');

    const body = new URLSearchParams();
    body.append('f.req', freq);
    body.append('at', tokens.at);

    const response = await fetch(`${ENDPOINT}?${params.toString()}`, {
      method: 'POST',
      body: body,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
    });

    if (!response.ok) {
      throw { code: 'network', message: `Batchexecute failed: ${response.status}` };
    }

    return await response.text();
  }

  scope.NLM_Client = {
    listNotebooks: async function () {
      const tokens = await scope.NLM_Tokens.fetchTokens();
      const payload = [null, 1, null, [2]];

      const raw = await executeRequest(scope.NLM_RPC.LIST_NOTEBOOKS, payload, tokens);
      return scope.NLM_Parse.parseListNotebooks(raw);
    },

    createNotebook: async function (title) {
      const tokens = await scope.NLM_Tokens.fetchTokens();
      const payload = [title];

      const raw = await executeRequest(scope.NLM_RPC.CREATE_NOTEBOOK, payload, tokens);
      return scope.NLM_Parse.parseCreateNotebook(raw);
    },

    addTextSource: async function (notebookId, title, content) {
      const tokens = await scope.NLM_Tokens.fetchTokens();

      const textSource = [null, [title, content], null, 2, null, null, null, null, null, null, 1];

      const payload = [[textSource], notebookId, [2]];

      const raw = await executeRequest(scope.NLM_RPC.ADD_SOURCE, payload, tokens);
      return scope.NLM_Parse.parseAddSource(raw);
    },
  };
})(globalThis);
