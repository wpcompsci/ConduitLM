/**
 * @file Service module for all interactions with the NotebookLM API.
 * @description This module encapsulates all the logic for authentication,
 * notebook creation, and data manipulation on the NotebookLM platform.
 */

// ====================================================================== 
// 1. CONSTANTS & CONFIG
// ====================================================================== 

const API_BASE_URL = 'https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute';

const RPC_IDS = {
    LIST_NOTEBOOKS: 'wXbhsf',
    CREATE_NOTEBOOK: 'CCqFvf',
    ADD_TEXT_SOURCE: 'izAoDd',
    CHECK_SOURCE_STATUS: 'rLM1Ne',  
    DELETE_NOTEBOOK: 'WWINqb',
    GET_SOURCE_CONTENT: 'hizoJc',
};

// ====================================================================== 
// 2. CORE API HELPERS
// ====================================================================== 

/**
 * Finds a specific token from the NotebookLM homepage HTML.
 * @param {string} tokenName - The key for the token to find.
 * @param {string} htmlText - The HTML content of the page.
 * @returns {string|null} The found token or null.
 */
function findNotebookLMToken(tokenName, htmlText) {
    const regex = new RegExp(`"${tokenName}":"([^"]+)"`);
    const match = regex.exec(htmlText);
    return match ? match[1] : null;
}

/**
 * Fetches the primary authentication tokens from the NotebookLM homepage.
 * @returns {{atToken: string, blToken: string}}
 * @throws {Error} If tokens cannot be found or the user is not logged in.
 */
 async function getAuthTokens() {
    try {
        const response = await fetch("https://notebooklm.google.com/", { redirect: "error" });
        if (!response.ok) {
            throw new Error("Please log in to NotebookLM first.");
        }
        const htmlText = await response.text();
        const atToken = findNotebookLMToken("SNlM0e", htmlText);
        const blToken = findNotebookLMToken("cfb2h", htmlText);

        if (!atToken || !blToken) {
            throw new Error("Could not find NotebookLM authentication tokens.");
        }
        return { atToken, blToken };
    } catch (error) {
        console.error("Kortex: Authentication failed.", error);
        throw new Error("Authentication failed. Please ensure you are logged into NotebookLM.");
    }
}

/**
 * Executes a batch request to the NotebookLM API.
 * @param {string} rpcId - The RPC identifier for the specific action.
 * @param {object} payload - The data payload for the request.
 * @param {string} atToken - The 'at' authentication token.
 * @param {string} blToken - The 'bl' authentication token.
 * @param {string} [sourcePath='/'] - The source path for the request.
 * @returns {Promise<Response>}
 * @throws {Error} If the API request fails.
 */
 async function batchExecute(rpcId, payload, atToken, blToken, sourcePath = '/') {
    const reqId = (Math.floor(9e5 * Math.random()) + 1e5).toString();
    const rpcPayload = JSON.stringify([[[rpcId, JSON.stringify(payload), null, "generic"]]])
    const apiUrl = `${API_BASE_URL}?rpcids=${rpcId}&source-path=${sourcePath}&bl=${blToken}&_reqid=${reqId}&rt=c`;

    const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `f.req=${encodeURIComponent(rpcPayload)}&at=${atToken}`
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Kortex API Error:", { status: response.status, body: errorBody });
        throw new Error(`API request failed with status: ${response.status}`);
    }
    return response;
}

// ====================================================================== 
// 3. PUBLIC API METHODS
// ====================================================================== 

/**
 * Lists all available notebooks for the user.
 * @param {string} atToken - The 'at' authentication token.
 * @param {string} blToken - The 'bl' authentication token.
 * @returns {Promise<Array<{id: string, name: string, emoji: string}>>} A list of notebooks.
 */
 async function listNotebooks(atToken, blToken) {
    const payload = [null, 1, null, [2]];
    const response = await batchExecute(RPC_IDS.LIST_NOTEBOOKS, payload, atToken, blToken);
    const responseText = await response.text();
    const dataLine = responseText.split('\n')[3];
    const parsedData = JSON.parse(JSON.parse(dataLine)[0][2]);
    const notebookList = parsedData[0];

    if (!notebookList) return [];

    return notebookList
        .filter(notebook => !(notebook?.[5]?.[0] === 3)) // Filter out trashed notebooks
        .map(notebook => ({
            id: notebook[2],
            name: notebook[0]?.trim() || "Untitled Notebook",
            emoji: notebook[3] || '📔'
        }))
        .filter(Boolean);
}

/**
 * Creates a new notebook.
 * @param {string} title - The title for the new notebook.
 * @param {string} atToken - The 'at' authentication token.
 * @param {string} blToken - The 'bl' authentication token.
 * @returns {Promise<string|null>} The ID of the newly created notebook.
 */
 async function createNotebook(title, atToken, blToken) {
    const payload = [title];
    const response = await batchExecute(RPC_IDS.CREATE_NOTEBOOK, payload, atToken, blToken);
    const responseText = await response.text();
    const match = responseText.match(/\b[0-9a-fA-F]{8}-(?:\d|[a-fA-F]){4}-(?:\d|[a-fA-F]){4}-(?:\d|[a-fA-F]){4}-(?:\d|[a-fA-F]){12}\b/);
    return match ? match[0] : null;
}

/**
 * Adds a text-based source to an existing notebook.
 * @param {string} title - The title of the source.
 * @param {string} content - The text content of the source.
 * @param {string} notebookId - The ID of the target notebook.
 * @param {string} atToken - The 'at' authentication token.
 * @param {string} blToken - The 'bl' authentication token.
 */
 async function addTextSource(title, content, notebookId, atToken, blToken) {
    const textSource = [null, [title, content], null, 2, null, null, null, null, null, null, 1];
    const sourcesList = [textSource];
    const payload = [sourcesList, notebookId, [2]];
    const sourcePath = `/notebook/${notebookId}`;
    await batchExecute(RPC_IDS.ADD_TEXT_SOURCE, payload, atToken, blToken, sourcePath);
}

/**
 * Adds a Google Doc source to an existing notebook.
 * @param {string} docId - The ID of the Google Document.
 * @param {string} title - The title of the source.
 * @param {string} notebookId - The ID of the target notebook.
 * @param {string} atToken - The 'at' authentication token.
 * @param {string} blToken - The 'bl' authentication token.
 */
 async function addGDocSource(docId, title, notebookId, atToken, blToken) {
    const docSourceData = [docId, "application/vnd.google-apps.document", 1, title];
    const docSource = [docSourceData, null, null, null, null, null, null, null, null, null, 1];
    
    const sourcesList = [docSource];
    const additionalParam = [1, null, null, null, null, null, null, null, null, null, [1]];

    const payload = [sourcesList, notebookId, [2], additionalParam];
    const sourcePath = `/notebook/${notebookId}`;

    await batchExecute(RPC_IDS.ADD_TEXT_SOURCE, payload, atToken, blToken, sourcePath);
}

/**
 * Checks if the sources in a notebook are ready.
 * @param {string} notebookId - The ID of the notebook to check.
 * @param {string} atToken - The 'at' authentication token.
 * @param {string} blToken - The 'bl' authentication token.
 * @returns {Promise<boolean>} True if the source is ready, false otherwise.
 */
 async function isSourceReady(notebookId, atToken, blToken) {
    const payload = [notebookId, null, [2]];
    const sourcePath = `/notebook/${notebookId}`;
    const response = await batchExecute(RPC_IDS.CHECK_SOURCE_STATUS, payload, atToken, blToken, sourcePath);
    const responseText = await response.text();
    // The "still processing" string is present when not ready.
    return responseText.indexOf(`null,\"${notebookId}\"`) === -1;
}

/**
 * Deletes (moves to trash) a specific notebook.
 * @param {string} notebookId - The ID of the notebook to delete.
 * @param {string} atToken - The 'at' authentication token.
 * @param {string} blToken - The 'bl' authentication token.
 */
 async function deleteNotebook(notebookId, atToken, blToken) {
    // This payload structure is based on your network inspection.
    const payload = [[notebookId], [2]];
    await batchExecute(RPC_IDS.DELETE_NOTEBOOK, payload, atToken, blToken);
}


/**
 * Fetches and parses the list of sources for a given notebook.
 * @param {string} notebookId - The ID of the notebook.
 * @param {string} atToken - The 'at' authentication token.
 * @param {string} blToken - The 'bl' authentication token.
 * @returns {Promise<Array<{id: string, name: string}>>} A list of sources.
 */
 async function getNotebookSources(notebookId, atToken, blToken) {
    const payload = [notebookId, null, [2]];
    const sourcePath = `/notebook/${notebookId}`;
    const response = await batchExecute(RPC_IDS.CHECK_SOURCE_STATUS, payload, atToken, blToken, sourcePath);
    const responseText = await response.text();
    const dataLine = responseText.split('\n')[3];
    const parsedData = JSON.parse(JSON.parse(dataLine)[0][2]);

   // --- DEBUGGING LOGS ADDED HERE ---
    console.log('Raw parsedData from API:', parsedData);
    
    const sourceList = parsedData?.[0]?.[1] || [];
    
    console.log('Constructed sourceList to be mapped:', sourceList);

    return sourceList.map(source => ({
        // UPDATED MAPPING: The ID is now nested inside the first element,
        // and the name is the second element.
        id: source?.[0]?.[0], 
        name: source?.[1] 
    })).filter(s => s.id && s.name);
}



/**
 * Fetches the extracted text content of a single source from NotebookLM.
 * @returns {Promise<string[]>} An array of text snippets from the source.
 */
async function getSourceContent(sourceId, notebookId, atToken, blToken) {
    const payload = [[sourceId], [2], [2]];
    const sourcePath = `/notebook/${notebookId}`;

    const response = await batchExecute(RPC_IDS.GET_SOURCE_CONTENT, payload, atToken, blToken, sourcePath);
    const responseText = await response.text();
    
    const dataLine = responseText.split('\n')[3];
    const parsedData = JSON.parse(JSON.parse(dataLine)[0][2]);

    const extractStrings = (arr) => {
        let strings = [];
        for (const item of arr) {
            if (typeof item === 'string') {
                if(item.length > 10){
                    strings.push(item.trim());
                }
            } else if (Array.isArray(item)) {
                strings = strings.concat(extractStrings(item));
            }
        }
        return strings;
    };

    const allTextSnippets = extractStrings(parsedData);
    
    if (allTextSnippets.length === 0) {
        console.warn(`[getSourceContent] Could not find any text snippets for source ${sourceId}.`, parsedData);
        return []; // Return empty array if nothing is found
    }
    
    // MODIFICATION: Return the array of snippets instead of a joined string.
    return allTextSnippets;
}


