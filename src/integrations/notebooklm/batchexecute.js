// NotebookLM Batchexecute Helper
(function (scope) {
  const HOST_ORIGIN = 'https://notebooklm.google.com';
  const ENDPOINT = `${HOST_ORIGIN}/_/LabsTailwindUi/data/batchexecute`;

  async function execute(rpcId, payload, tokens, sourcePath) {
    const reqId = Math.floor(Math.random() * 900000 + 100000).toString();
    const rpcPayload = JSON.stringify([[[rpcId, JSON.stringify(payload), null, 'generic']]]);

    const params = new URLSearchParams();
    params.append('rpcids', rpcId);
    params.append('source-path', sourcePath || '/');
    params.append('bl', tokens.bl);
    params.append('_reqid', reqId);
    params.append('rt', 'c');

    const body = new URLSearchParams();
    body.append('f.req', rpcPayload);
    body.append('at', tokens.at);

    const response = await fetch(`${ENDPOINT}?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw {
        code: 'network',
        message: `NotebookLM batchexecute failed: ${response.status}`,
        detail: errorBody.slice(0, 400),
      };
    }

    return await response.text();
  }

  scope.NLM_Batch = {
    execute,
  };
})(globalThis);
