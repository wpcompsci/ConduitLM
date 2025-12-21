// /src/background.js

const SNIPPETS_NOTEBOOK_NAME = "My Web Snippets";

// REPLACE the old sourceFormatters object in background.js with this new one.

const sourceFormatters = {
    md: (sourceName, snippets) => {
        // 1. Create YAML Front Matter for metadata
        const frontMatter = `---
sourceFile: "${sourceName}"
exportedBy: "Kortex"
exportDate: "${new Date().toISOString()}"
---

`;

        let body = `# ${sourceName}\n\n`;

        // 2. Intelligently process each snippet
        snippets.forEach(line => {
            // Trim whitespace from the line
            const trimmedLine = line.trim();
            if (!trimmedLine) return; // Skip empty lines

            // Regex to find numbered headings like "1. Title" or "2.3. Subsection"
            if (/^\d+(\.\d+)*\.\s+[A-Z]/.test(trimmedLine)) {
                const level = (trimmedLine.match(/\./g) || []).length + 2; // e.g., "1." is h2, "1.1." is h3
                body += `${'#'.repeat(level)} ${trimmedLine}\n\n`;
            
            // Regex for bullet points (using various common bullet characters)
            } else if (/^[\*•-]\s+/.test(trimmedLine)) {
                // Ensure it's treated as a list item
                body += `${trimmedLine}\n`;

            // Heuristic for title-case, short lines to be treated as headings
            } else if (trimmedLine.length < 80 && /^[A-Z][A-Za-z\s]+$/.test(trimmedLine) && !trimmedLine.endsWith('.')) {
                 body += `## ${trimmedLine}\n\n`;
            
            // Otherwise, treat it as a standard paragraph
            } else {
                body += `${trimmedLine}\n\n`;
            }
        });

        return frontMatter + body;
    },
    txt: (sourceName, snippets) => {
        // The text formatter remains the same
        const header = `Source: ${sourceName}\nExported via Kortex: ${new Date().toLocaleString()}\n====================\n\n`;
        const body = snippets.join('\n\n');
        return header + body;
    }
};

/**
 * @file background.js
 * @description Main background script for the Kortex extension.
 * This script acts as a router, listening for messages from content scripts
 * and delegating tasks to the appropriate service modules.
 */

// ======================================================================
// 1. UTILITY & HELPER FUNCTIONS
// ======================================================================



/**
 * Sends a status update message to a specific tab.
 * @param {number} tabId - The ID of the tab to send the message to.
 * @param {'loading'|'success'|'error'} status - The status type.
 * @param {string} message - The message to display in the UI.
 */
function updateUI(tabId, status, message) {
    chrome.tabs.sendMessage(tabId, { type: 'UPDATE_STATUS', status, message })
        .catch(err => console.warn("Could not send message to tab. It might be closed.", err));
}

/**
 * Formats a conversation array into a readable plain text string.
 * @param {Array<{role: string, content: string}>} conversation - The conversation data.
 * @param {string} [sourceTitle=''] - The full title of the source, e.g., "[GEMINI] My Title".
 * @returns {string} A formatted string representation of the conversation.
 */
function formatConversationAsText(conversation, sourceTitle = '') {
    // Use a regular expression to find the text inside the brackets, e.g., "GEMINI"
    const match = sourceTitle.match(/^\[(.*?)\]/);
    const platform = match ? match[1] : 'Unknown Platform';

    let text = `Platform: ${platform}
Saved via Kortex from ${platform}: ${new Date().toLocaleString()}
====================

`;
    conversation.forEach(message => {
        const role = message.role.charAt(0).toUpperCase() + message.role.slice(1);
        text += `${role}:
${message.content}

`;
    });
    return text;
}

// ======================================================================
// 2. CORE WORKFLOWS
// ======================================================================

async function handleGetNotebookSources(notebookId) {
    if (!notebookId) {
        return { success: false, message: "No notebook ID provided." };
    }
    try {
        const { atToken, blToken } = await getAuthTokens();
        const sources = await getNotebookSources(notebookId, atToken, blToken);
        return { success: true, sources };
    } catch (error) {
        console.error("Kortex: Could not get notebook sources.", error);
        return { success: false, message: error.message };
    }
}





// async function handleDownloadSelectedSources({ notebookId, selectedSourceIds, popupTabId, format }) {
//     if (!notebookId || !selectedSourceIds || selectedSourceIds.length === 0) {
//         return { success: false, message: "No sources were selected." };
//     }

//     try {
//         const { atToken, blToken } = await getAuthTokens();
//         const allSources = await getNotebookSources(notebookId, atToken, blToken);
//         const sourcesToDownload = allSources.filter(source => selectedSourceIds.includes(source.id));
        
//         if (sourcesToDownload.length === 0) throw new Error("Selected sources could not be found.");

//         const zip = new JSZip();
//         const contentPromises = sourcesToDownload.map(source =>
//             getSourceContent(source.id, notebookId, atToken, blToken)
//                 .then(textContentSnippets => ({ ...source, textContentSnippets }))
//                 .catch(err => ({ ...source, error: true }))
//         );
//         const results = await Promise.all(contentPromises);

//         results.forEach(result => {
//             if (!result.error && result.textContentSnippets?.length > 0) {
//                 // --- THIS IS THE NEW LOGIC ---
//                 // Get the correct formatter function, defaulting to 'txt'
//                 const formatter = sourceFormatters[format] || sourceFormatters.txt;
                
//                 // Create the final content using the selected formatter
//                 const finalContent = formatter(result.name, result.textContentSnippets);
                
//                 // Set the filename with the correct extension
//                 const filename = result.name.replace(/\.[^/.]+$/, "") + `.${format}`;
//                 zip.file(filename, finalContent);
//             }
//         });

//         const zipBlob = await zip.generateAsync({ type: 'blob' });
//         const notebookName = allSources[0]?.name.split(' ')[0] || notebookId;
        
//         const downloadUrl = await new Promise(resolve => {
//             const reader = new FileReader();
//             reader.onload = () => resolve(reader.result);
//             reader.readAsDataURL(zipBlob);
//         });
        
//         chrome.downloads.download({
//             url: downloadUrl,
//             filename: `Kortex_Export_${notebookName}.zip`,
//             saveAs: true
//         }, (downloadId) => {
//             const onDownloadChanged = (delta) => {
//                 if (delta.id === downloadId && delta.state && (delta.state.current !== 'in_progress')) {
//                     if (popupTabId) {
//                          chrome.tabs.sendMessage(popupTabId, { type: 'DOWNLOAD_COMPLETE_CLOSE_POPUP' });
//                     }
//                     chrome.downloads.onChanged.removeListener(onDownloadChanged);
//                 }
//             };
//             chrome.downloads.onChanged.addListener(onDownloadChanged);
//         });

//         return { success: true };

//     } catch (error) {
//         console.error("Kortex: Failed during source download process.", error);
//         return { success: false, message: error.message };
//     }
// }

/**
 * [NEW HELPER FUNCTION] Converts a Blob object to a Base64 Data URL.
 * This is necessary because Service Workers cannot use URL.createObjectURL.
 * @param {Blob} blob - The blob to convert.
 * @returns {Promise<string>} A promise that resolves with the Data URL.
 */
function blobToDataURL (blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.onabort = () => reject(new Error('Blob reading was aborted.'));
    reader.readAsDataURL(blob);
  });
}

// ======================================================================
// >>>>> NEW: MARKDOWN to PDF GENERATOR
// ======================================================================
/**
 * Generates a multi-page, formatted PDF from a Markdown string.
 * This is a custom parser that handles headings, paragraphs, and basic formatting.
 * @param {string} markdownContent - The markdown string to render.
 * @returns {Promise<Blob>} A promise that resolves with the generated PDF Blob.
 */
async function generateMarkdownPdf (markdownContent) {
  const { jsPDF } = globalThis.jspdf;
  const doc = new jsPDF();

  // --- PDF Styling Configuration ---
  const PAGE_WIDTH = doc.internal.pageSize.getWidth();
  const MARGIN = 15;
  const MAX_WIDTH = PAGE_WIDTH - MARGIN * 2;
  const FONT_SIZES = { h1: 18, h2: 16, h3: 14, body: 11, code: 10 };
  const LINE_HEIGHT = 1.5;

  let cursorY = MARGIN; // Start drawing from the top margin

  // Helper to check for page overflow and add a new page if needed
  const checkPageBreak = neededHeight => {
    if (cursorY + neededHeight > doc.internal.pageSize.getHeight() - MARGIN) {
      doc.addPage();
      cursorY = MARGIN;
    }
  };

  const lines = markdownContent.split('\n');

  for (const line of lines) {
    if (line.startsWith('### ')) {
      const text = line.substring(4);
      checkPageBreak(FONT_SIZES.h3);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(FONT_SIZES.h3);
      doc.text(text, MARGIN, cursorY, { maxWidth: MAX_WIDTH });
      cursorY += FONT_SIZES.h3 * 0.7; // Tighter spacing after a heading
    } else if (line.startsWith('## ')) {
      const text = line.substring(3);
      checkPageBreak(FONT_SIZES.h2);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(FONT_SIZES.h2);
      doc.text(text, MARGIN, cursorY, { maxWidth: MAX_WIDTH });
      cursorY += FONT_SIZES.h2 * 0.7;
    } else if (line.startsWith('# ')) {
      const text = line.substring(2);
      checkPageBreak(FONT_SIZES.h1);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(FONT_SIZES.h1);
      doc.text(text, MARGIN, cursorY, { maxWidth: MAX_WIDTH });
      cursorY += FONT_SIZES.h1 * 0.7;
    } else if (line.startsWith('> ')) {
      const text = line.substring(2);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(FONT_SIZES.body);

      const splitText = doc.splitTextToSize(text, MAX_WIDTH - 5); // Indent blockquotes
      checkPageBreak(splitText.length * FONT_SIZES.body * 0.5);

      // Draw a vertical line for the blockquote
      doc.setDrawColor(200, 200, 200); // Light grey
      doc.rect(
        MARGIN,
        cursorY - FONT_SIZES.body * 0.5,
        1,
        splitText.length * FONT_SIZES.body * 0.5 + 2
      );

      doc.setTextColor(100, 100, 100); // Grey text
      doc.text(splitText, MARGIN + 5, cursorY);
      doc.setTextColor(0, 0, 0); // Reset text color
      cursorY += splitText.length * FONT_SIZES.body * 0.5;
    } else if (line.trim() === '---') {
      checkPageBreak(10);
      doc.setDrawColor(150, 150, 150);
      doc.line(MARGIN, cursorY, PAGE_WIDTH - MARGIN, cursorY); // Horizontal line
      cursorY += 5;
    } else if (line.trim().length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(FONT_SIZES.body);
      const splitText = doc.splitTextToSize(line, MAX_WIDTH);
      checkPageBreak(splitText.length * FONT_SIZES.body * 0.5);
      doc.text(splitText, MARGIN, cursorY);
      cursorY += splitText.length * FONT_SIZES.body * 0.5;
    }

    // Add a bit of space after every element
    cursorY += 5;
  }

  return doc.output('blob');
}

/**
 * Handles the logic for fetching, formatting, zipping, and downloading selected sources.
 * Now includes functionality for generating PDF files.
 * @param {object} data - The request data.
 * @param {string} data.notebookId - The ID of the notebook.
 * @param {string[]} data.selectedSourceIds - An array of source IDs to download.
 * @param {string} data.format - The desired format ('md', 'txt', or 'pdf').
 * @returns {Promise<{success: boolean, message?: string}>}
 */
async function handleDownloadSelectedSources (data) {
  const { notebookId, selectedSourceIds, format } = data;

  if (!notebookId || !selectedSourceIds || selectedSourceIds.length === 0) {
    return { success: false, message: 'Missing required data for download.' };
  }

  try {
    // 1. Authenticate and get all sources for the notebook
    const authTokens = await getAuthTokens();
    const allSources = await getNotebookSources(
      notebookId,
      authTokens.atToken,
      authTokens.blToken
    );
    const notebook = allSources.find(s => s.id === notebookId);

    // 2. Filter down to only the sources the user selected
    const selectedSources = allSources.filter(source =>
      selectedSourceIds.includes(source.id)
    );

    if (selectedSources.length === 0) {
      return {
        success: false,
        message: 'No valid sources selected for download.',
      };
    }

    // 3. Initialize the zip file generator
    const zip = new JSZip();

    // 4. Loop through each selected source, fetch its content, format it, and add to zip
    for (const source of selectedSources) {
      const sourceContentSnippets = await getSourceContent(
        source.id,
        notebookId,
        authTokens.atToken,
        authTokens.blToken
      );

      const cleanSourceName = source.name.replace(/[<>:"/\\|?*]/g, '_');
      const filename = `${cleanSourceName}.${format}`;

      // --- >>>>> MODIFICATION START <<<<< ---
      if (format === 'pdf') {
        // a. Get the RICHLY FORMATTED markdown content first.
        const markdownContent = sourceFormatters.md(
          source.name,
          sourceContentSnippets
        );

        // b. Pass it to our new, powerful PDF generator.
        const pdfBlob = await generateMarkdownPdf(markdownContent);

        // c. Add the generated PDF blob to our zip file.
        zip.file(filename, pdfBlob);
      } else {
        // --- Existing Logic for MD and TXT (no changes here) ---
        const formattedContent = sourceFormatters[format](
          source.name,
          sourceContentSnippets
        );
        zip.file(filename, formattedContent);
      }
      // --- >>>>> MODIFICATION END <<<<< ---
    }

    // 5. Generate the final zip file as a blob and convert to a Data URL
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipUrl = await blobToDataURL(zipBlob);
    const zipFilename = notebook
      ? `${notebook.name.replace(/[<>:"/\\|?*]/g, '_')}_sources.zip`
      : 'NotebookLM_Sources.zip';

    // 6. Trigger the download in the user's browser using the Data URL
    chrome.downloads.download(
      {
        url: zipUrl,
        filename: zipFilename,
        saveAs: true, // Prompt the user where to save it
      },
      downloadId => {
        if (chrome.runtime.lastError) {
          console.error(
            'Kortex download initiation error:',
            chrome.runtime.lastError.message
          );
          return;
        }

        const onDownloadChanged = delta => {
          if (delta.id === downloadId) {
            if (
              delta.state &&
              (delta.state.current === 'complete' ||
                delta.state.current === 'interrupted')
            ) {
              chrome.runtime.sendMessage({
                type: 'DOWNLOAD_COMPLETE_CLOSE_POPUP',
              });
              chrome.downloads.onChanged.removeListener(onDownloadChanged);
            }
          }
        };

        chrome.downloads.onChanged.addListener(onDownloadChanged);
      }
    );

    return { success: true, message: 'Download initiated.' };
  } catch (error) {
    console.error(
      'Kortex: CRITICAL ERROR during source download process:',
      error
    );
    return { success: false, message: `An error occurred: ${error.message}` };
  }
}





/**
 * Finds the "My Web Snippets" notebook or creates it if it doesn't exist.
 * @param {string} atToken - The 'at' authentication token.
 * @param {string} blToken - The 'bl' authentication token.
 * @returns {Promise<string>} The ID of the snippets notebook.
 */
async function getOrCreateSnippetsNotebook(atToken, blToken) {
    const notebooks = await listNotebooks(atToken, blToken);
    const snippetsNotebook = notebooks.find(nb => nb.name === SNIPPETS_NOTEBOOK_NAME);

    if (snippetsNotebook) {
        console.log(`Kortex: Found existing snippets notebook: ${snippetsNotebook.id}`);
        return snippetsNotebook.id;
    } else {
        console.log(`Kortex: No snippets notebook found. Creating one.`);
        const newNotebookId = await createNotebook(SNIPPETS_NOTEBOOK_NAME, atToken, blToken);
        if (!newNotebookId) {
            throw new Error("Failed to create the snippets notebook.");
        }
        return newNotebookId;
    }
}


/**
 * Handles the workflow for saving a highlighted text snippet to NotebookLM.
 * @param {string} selectionText - The text the user highlighted.
 * @param {string} pageUrl - The URL of the page where the text was highlighted.
 * @param {number} tabId - The ID of the tab to send feedback to.
 */

async function handleSaveSnippet(data) {
    const { selectionText, pageUrl, pageTitle, notebookId } = data;
    try {
        const { atToken, blToken } = await getAuthTokens();
        let finalNotebookId = notebookId;

        if (!finalNotebookId) {
            const newNotebookTitle = `[SNIPPETS] ${pageTitle}`;
            finalNotebookId = await createNotebook(newNotebookTitle, atToken, blToken);
            if (!finalNotebookId) throw new Error("Failed to create snippet notebook.");
        }
        
        const sourceTitle = selectionText.split(' ').slice(0, 8).join(' ') + '...';
        const sourceContent = `Source URL: ${pageUrl}\nDate Snipped: ${new Date().toLocaleString()}\n\n---\n\n${selectionText}`;
        await addTextSource(sourceTitle, sourceContent, finalNotebookId, atToken, blToken);

        // Simply return a success object
        return { success: true, message: "Snippet saved successfully!" };

    } catch (error) {
        console.error("Kortex: Failed to save snippet.", error);
        // Return an error object
        return { success: false, message: error.message };
    }
}

/**
 * Handles the complete workflow for saving a conversation OR a Google Doc to NotebookLM.
 * This function now checks the conversation data to decide which import path to take.
 * @param {number} tabId - The ID of the originating tab.
 * @param {Array} conversation - The conversation data, or a special object for Google Docs.
 * @param {string|null} notebookId - The ID of an existing notebook, or null to create a new one.
 * @param {string} source - The title for the new source or notebook.
 * @returns {Promise<{success: boolean, url?: string, message?: string}>}
 */
async function handleSaveConversation(tabId, conversation, notebookId, source) {
    const title = source;
    
    // Check if this is a special Google Doc import request
    const isGDocImport = conversation && conversation.length === 1 && conversation[0].role === 'document';

    try {
        updateUI(tabId, 'loading', 'Authenticating...');
        const { atToken, blToken } = await getAuthTokens();

        let finalNotebookId = notebookId;

        if (!finalNotebookId) {
            updateUI(tabId, 'loading', 'Creating Notebook...');
            finalNotebookId = await createNotebook(title, atToken, blToken);
            if (!finalNotebookId) {
                throw new Error("Failed to create the notebook.");
            }
        }

        // === LOGIC ROUTER ===
        // If it's a GDoc, use the specific GDoc import function.
        // Otherwise, use the standard text formatting logic.
        if (isGDocImport) {
            updateUI(tabId, 'loading', 'Importing Google Doc...');
            const docId = conversation[0].content;
            await addGDocSource(docId, title, finalNotebookId, atToken, blToken);
        } else {
            updateUI(tabId, 'loading', 'Adding Source...');
            const formattedText = formatConversationAsText(conversation, source);
            await addTextSource(title, formattedText, finalNotebookId, atToken, blToken);
        }

        updateUI(tabId, 'loading', 'Verifying Source...');
        let isReady = false;
        for (let i = 0; i < 10; i++) { // Poll for 20 seconds max
            await new Promise(resolve => setTimeout(resolve, 2000));
            isReady = await isSourceReady(finalNotebookId, atToken, blToken);
            if (isReady) break;
        }

        if (!isReady) {
            console.warn("Kortex: Timed out waiting for source to be ready. Opening anyway.");
        }

        const notebookUrl = `https://notebooklm.google.com/notebook/${finalNotebookId}`;
        updateUI(tabId, 'success', 'Done!');
        chrome.tabs.create({ url: notebookUrl });
        console.log(`Kortex: Process complete. Opening ${notebookUrl}`);
        return { success: true, url: notebookUrl };

    } catch (error) {
        console.error("Kortex Error:", error);
        updateUI(tabId, 'error', error.message || 'An unknown error occurred.');
        return { success: false, message: error.message };

        
    }
}

/**
 * Handles a request to get the list of available notebooks.
 * @returns {Promise<{success: boolean, notebooks?: Array, message?: string}>}
 */
async function handleGetNotebooks() {
    try {
        const { atToken, blToken } = await getAuthTokens();
        const notebooks = await listNotebooks(atToken, blToken);
        return { success: true, notebooks };
    } catch (error) {
        console.error("Kortex: Could not get notebook list.", error);
        return { success: false, message: error.message };
    }
}

async function handleDeleteNotebooks(data) {
    const { ids } = data;
    if (!ids || ids.length === 0) {
        return { success: false, message: "No notebooks selected." };
    }

    console.log(`Kortex: Received request to delete ${ids.length} notebooks.`);
    try {
        const { atToken, blToken } = await getAuthTokens();
        // Loop through the IDs and delete them sequentially
        for (const notebookId of ids) {
            console.log(`Kortex: Deleting notebook ${notebookId}...`);
            await deleteNotebook(notebookId, atToken, blToken);
            // Add a small delay to be kind to the API
            await new Promise(resolve => setTimeout(resolve, 250));
        }
        console.log("Kortex: Bulk deletion complete.");
        return { success: true };
    } catch (error) {
        console.error("Kortex: Bulk deletion failed.", error);
        return { success: false, message: error.message };
    }
}

// ======================================================================
// 3. EVENT LISTENERS
// ======================================================================

// Creates the context menu item when the extension is installed.
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "save-selection-to-notebooklm",
        title: "Send highlight to NotebookLM",
        contexts: ["selection"] // This makes it appear only when text is selected
    });
});

// Listens for a click on our context menu item.
// 1. Update the context menu listener to open the popup
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "save-selection-to-notebooklm") {
        if (info.selectionText) {
            const popupUrl = new URL(chrome.runtime.getURL('src/popup/popup.html'));
            popupUrl.searchParams.append('selectionText', info.selectionText);
            popupUrl.searchParams.append('pageUrl', tab.url);
            popupUrl.searchParams.append('pageTitle', tab.title);
            popupUrl.searchParams.append('tabId', tab.id);

            // Create a new popup window
            chrome.windows.create({
                url: popupUrl.href,
                type: 'popup',
                width: 400,
                height: 550
            });
        }
    }
});


/**
 * Main message listener for the extension.
 * Routes requests from content scripts to the appropriate handler.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!sender.tab?.id) {
        // Ignore messages from non-tab contexts if they are not needed
        return false;
    }

    switch (request.type) {
        case 'SAVE_CONVERSATION': {
            const { conversation, notebookId, source } = request.data;
            handleSaveConversation(sender.tab.id, conversation, notebookId, source)
                .then(sendResponse);
            return true;
        }

        case 'GET_NOTEBOOK_LIST': {
            handleGetNotebooks()
                .then(sendResponse);
            return true;
        }
        
        case 'SAVE_SNIPPET': {
            handleSaveSnippet(request.data)
                .then(sendResponse); 
            return true;
        }
        
        case 'DELETE_NOTEBOOKS': {
            handleDeleteNotebooks(request.data)
                .then(sendResponse);
            return true;
        }

        case 'GET_NOTEBOOK_SOURCES': {
            const { notebookId } = request.data;
            handleGetNotebookSources(notebookId)
                .then(sendResponse);
            return true;

        
        }
        
        case 'DOWNLOAD_SELECTED_SOURCES': {
            handleDownloadSelectedSources(request.data)
                .then(sendResponse);
            return true;
        }
        
        case 'OPEN_DOWNLOAD_POPUP': {
            const { notebookId } = request.data;
            const popupUrl = new URL(chrome.runtime.getURL('src/download/download.html'));
            popupUrl.searchParams.append('notebookId', notebookId);
            
            // The background script CAN create windows.
            chrome.windows.create({
                url: popupUrl.href,
                type: 'popup',
                width: 420,
                height: 600
            });
            // No response needed for fire-and-forget actions
            return false; 
        }

        default: {
            console.warn(`Kortex: Received unknown message type "${request.type}"`);
            return false;
        }
    }
});



console.log("Kortex: Background script initialized.");
