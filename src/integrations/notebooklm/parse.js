// NotebookLM Response Parsing
(function (scope) {
  function safeJSONParse(text) {
    if (!text) throw { code: 'parse', message: 'Empty response body' };
    const clean = text.replace(/^\)]}'\s*/, '');

    // Batchexecute often includes length prefixes or multiple chunks.
    // We look for the first line that parses into a standard envelope Array.
    const lines = clean.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        // Ignore lines that aren't valid JSON (like partials)
        // or continue if it's valid JSON but not an array (like a length prefix)
      }
    }

    throw { code: 'parse', message: 'No valid JSON array found in response' };
  }

  scope.NLM_Parse = {
    /**
     * Parses and validates Batchexecute response.
     * Expects envelope -> payload -> data.
     */
    parseListNotebooks: function (responseText) {
      const json = safeJSONParse(responseText);

      // Envelope check
      // [ ["wXbhsf", "<payload>", null, ... ] ... ]
      if (!Array.isArray(json)) throw { code: 'parse', message: 'Root not array' };

      // Find the list RPC response
      const responseItem = json.find(
        (item) => Array.isArray(item) && item[0] === scope.NLM_RPC.LIST_NOTEBOOKS
      );

      if (!responseItem) {
        throw { code: 'parse', message: 'List RPC ID not found in response' };
      }

      // Kortex uses index 2 for the payload string. We should check 1 and 2.
      const payloadStr = responseItem[1] || responseItem[2];
      if (!payloadStr) {
        throw { code: 'parse', message: 'List RPC payload missing (checked idx 1 & 2)' };
      }

      try {
        const data = JSON.parse(payloadStr);

        // Kortex: const map = JSON.parse(JSON.parse(dataLine)[0][2]);
        // Our data is that inner parse.
        // Kortex says: parsedData[0] is the list.

        // Let's inspect the data structure based on Kortex:
        // data is [ [notebooks...], ... ] ?
        // Kortex: const notebookList = parsedData[0];

        if (!Array.isArray(data)) throw new Error('Data payload not array');

        // Assuming data[0] is the list based on Kortex (my previous code used data[1])
        // Let's try to match Kortex logic: parsedData[0]
        const notebooksArray = data[0];

        if (!Array.isArray(notebooksArray)) {
          // Fallback/Safety: try data[1] if data[0] isn't it?
          // But Kortex is explicit about parsedData[0].
          return [];
        }

        // Map safely using Kortex indices
        // id: notebook[2]
        // name: notebook[0]
        return notebooksArray
          .map((nb) => {
            if (!Array.isArray(nb)) return null;
            return {
              id: nb[2], // Kortex ID index
              title: nb[0] || 'Untitled Notebook', // Kortex Name index
            };
          })
          .filter((nb) => nb && nb.id); // Filter items with valid IDs
      } catch (e) {
        throw { code: 'parse', message: 'List payload parsing failed', detail: e.message };
      }
    },

    parseCreateNotebook: function (responseText, title) {
      const json = safeJSONParse(responseText);
      const responseItem = json.find(
        (item) => Array.isArray(item) && item[0] === scope.NLM_RPC.CREATE_NOTEBOOK
      );

      if (!responseItem) throw { code: 'parse', message: 'Create RPC ID not found' };

      const payloadStr = responseItem[1] || responseItem[2];
      if (!payloadStr) throw { code: 'parse', message: 'Create RPC payload missing' };

      try {
        const data = JSON.parse(payloadStr);
        // Kortex regexes the whole response, implying the structure might be complex.
        // Assuming standard Batchexecute return:
        // data usually contains the object created.
        // Let's guess the ID is at a similar index or try to find a UUID-like string if direct mapping fails?
        // But generally data[1] or data[0] probably holds the notebook details.

        // Let's assume data[0] like listNotebooks?
        // Or scan for ID.
        // For now, let's keep it simple: strict check, if fail, we might need regex fallback.

        // My previous code: nb = data[1]. id = nb[0]
        // If standard holds: nb might be at data[0]?
        // Let's try to look for the ID in the array recursively or just grab the first string that looks like an ID?

        // Safest bet for now: Check data[1] (prev) and data[0] (Kortex style)
        const nb = data[0] || data[1];
        if (Array.isArray(nb)) {
          // Check common indices for ID
          const potentialId = nb.find((x) => typeof x === 'string' && x.length > 20); // IDs are long UUIDs
          if (potentialId) return { id: potentialId, title: title || 'New Notebook' }; // We don't have title here unless we passed it
        }

        // Fallback: Use the Kortex regex method on the payloadStr just to be sure
        const match = payloadStr.match(
          /\b[0-9a-fA-F]{8}-(?:\d|[a-fA-F]){4}-(?:\d|[a-fA-F]){4}-(?:\d|[a-fA-F]){4}-(?:\d|[a-fA-F]){12}\b/
        );
        if (match) return { id: match[0], title: 'New Notebook' };

        if (Array.isArray(nb) && typeof nb[0] === 'string') {
          return { id: nb[0], title: nb[1] };
        }

        throw new Error('Could not locate created notebook ID');
      } catch (e) {
        throw { code: 'parse', message: 'Create payload parsing failed', detail: e.message };
      }
    },

    parseAddSource: function (responseText) {
      const json = safeJSONParse(responseText);
      const responseItem = json.find(
        (item) => Array.isArray(item) && item[0] === scope.NLM_RPC.ADD_SOURCE
      );

      if (!responseItem) throw { code: 'parse', message: 'Add Source RPC ID missing' };

      // Just check if we have a payload at all
      if (!responseItem[1] && !responseItem[2])
        throw { code: 'parse', message: 'Add Source payload missing' };

      return { success: true };
    },
  };
})(globalThis);
