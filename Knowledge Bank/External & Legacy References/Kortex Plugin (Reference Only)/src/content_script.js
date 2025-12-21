// Content script for Kortex extension

// IIFE to encapsulate the script and avoid global scope pollution
(function () {
  'use strict';

  // ======================================================================
  // 1. SHARED STATE & CONFIG
  // ======================================================================

  const UI_STATE = {
    archiveButton: null,
    originalButtonContent: null,
    dropdownMenu: null,
    portalContainer: null,
    exportDropdownMenu: null,
  };

  // ======================================================================
  // 2. PLATFORM-SPECIFIC CONFIGURATIONS
  // ======================================================================

  const platforms = [
    {
      name: 'ChatGPT',
      hostnames: ['chat.openai.com', 'chatgpt.com'],
      selectors: {
        UI_TARGET_ELEMENT: '#conversation-header-actions',
        TURN_CONTAINER: 'article[data-turn-id]',
        MESSAGE_ROLE: '[data-message-author-role]',
        MESSAGE_CONTENT: '.whitespace-pre-wrap, .markdown.prose',
      },
      scrapeConversation: function () {
        const messages = [];
        const turnElements = document.querySelectorAll(
          this.selectors.TURN_CONTAINER
        );
        turnElements.forEach(turn => {
          const roleElement = turn.querySelector(this.selectors.MESSAGE_ROLE);
          const contentElement = turn.querySelector(
            this.selectors.MESSAGE_CONTENT
          );
          if (roleElement && contentElement) {
            messages.push({
              role: roleElement.getAttribute('data-message-author-role'),
              content: contentElement.innerText,
            });
          }
        });
        return messages;
      },
      injectUI: function () {
        const updateButtonPosition = () => {
          const targetElement = document.querySelector(
            this.selectors.UI_TARGET_ELEMENT
          );
          const portal = createPortalContainer();
          const button = createArchiveButton(this);

          if (targetElement) {
            if (!portal.contains(button)) {
              button.className =
                'btn relative btn-ghost text-token-text-primary';
              portal.appendChild(button);
            }
            const rect = targetElement.getBoundingClientRect();
            portal.style.top = `${rect.top + window.scrollY}px`;
            portal.style.left = `${rect.left + window.scrollX}px`;
            portal.style.transform = `translateX(calc(-100% - 8px))`;
            portal.style.display = 'block';
          } else {
            portal.style.display = 'none';
          }
        };
        const observer = new MutationObserver(updateButtonPosition);
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
        });
        updateButtonPosition();
      },
    },
    {
      name: 'Gemini',
      hostnames: ['gemini.google.com'],
      selectors: {
        UI_TARGET_ELEMENT:
          'div.right-section > div.buttons-container',
        CONVERSATION_CONTAINER: 'div.conversation-container',
        USER_QUERY_BLOCK: 'user-query',
        MODEL_RESPONSE_BLOCK: 'model-response',
        USER_CONTENT: 'div.query-text',
        MODEL_CONTENT: 'div.markdown',
        CANVAS_CONTENT: 'immersive-editor .ProseMirror',
        // NEW: Selector for the active conversation's title in the sidebar.
        CONVERSATION_TITLE: '.conversation.selected .conversation-title',
      },
      scrapeConversation: function () {
        // This function from the previous update remains the same.
        const messages = [];
        const canvasElement = document.querySelector(
          this.selectors.CANVAS_CONTENT
        );
        if (canvasElement) {
          const canvasContent = canvasElement.innerText.trim();
          if (canvasContent) {
            messages.push({ role: 'model', content: canvasContent });
          }
        }
        const turnElements = document.querySelectorAll(
          `${this.selectors.CONVERSATION_CONTAINER} > ${this.selectors.USER_QUERY_BLOCK}, ${this.selectors.CONVERSATION_CONTAINER} > ${this.selectors.MODEL_RESPONSE_BLOCK}`
        );
        turnElements.forEach(turn => {
          let role = '';
          let content = '';
          if (turn.tagName.toLowerCase() === this.selectors.USER_QUERY_BLOCK) {
            role = 'user';
            const contentElement = turn.querySelector(
              this.selectors.USER_CONTENT
            );
            if (contentElement) content = contentElement.innerText.trim();
          } else if (
            turn.tagName.toLowerCase() === this.selectors.MODEL_RESPONSE_BLOCK
          ) {
            role = 'model';
            const contentElement = turn.querySelector(
              this.selectors.MODEL_CONTENT
            );
            if (contentElement) content = contentElement.innerText.trim();
          }
          if (role && content && !turn.querySelector('immersive-panel')) {
            messages.push({ role, content });
          }
        });
        if (canvasElement && messages.length > 1) {
          const canvasMessage = messages.shift();
          messages.push(canvasMessage);
        }
        return messages;
      },
      injectUI: function () {
        // This function remains the same.
        const updateButtonPosition = () => {
          const targetElement = document.querySelector(
            this.selectors.UI_TARGET_ELEMENT
          );
          const portal = createPortalContainer();
          const button = createArchiveButton(this);
          if (targetElement) {
            if (!portal.contains(button)) {
              button.className =
                'mdc-button mat-mdc-button-base gds-upsell-button ng-tns-c2625372804-5 mdc-button--unelevated mat-mdc-unelevated-button mat-unthemed';
              button.style.marginRight = '10px';
              portal.appendChild(button);
            }
            const rect = targetElement.getBoundingClientRect();
            portal.style.top = `${rect.top + window.scrollY}px`;
            portal.style.left = `${rect.left + window.scrollX}px`;
            portal.style.transform = `translateX(-100%)`;
            portal.style.display = 'block';
          } else {
            portal.style.display = 'none';
          }
        };
        const observer = new MutationObserver(updateButtonPosition);
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
        });
        updateButtonPosition();
      },
    }, // Add a comma after the Perplexity object
    {
      name: 'Google Docs',
      hostnames: ['docs.google.com'],
      selectors: {
        UI_TARGET_ELEMENT: '#docs-titlebar-share-client-button', // The "Share" button
        CONVERSATION_TITLE: 'input.docs-title-input',
        DOCS_CONTENT: '.kix-page-content-wrapper', // The main content area
      },
      scrapeConversation: function () {
        // Regular expression to extract the Doc ID from the URL
        const docIdMatch = window.location.href.match(
          /document\/d\/([a-zA-Z0-9_-]+)/
        );
        if (!docIdMatch || !docIdMatch[1]) {
          return []; // Return empty if no ID is found
        }
        const docId = docIdMatch[1];

        // We will send the docId as the "content" of a special message type.
        // The background script will use this ID to import the doc directly.
        return [
          {
            role: 'document',
            content: docId,
          },
        ];
      },
      injectUI: function () {
        const updateButton = () => {
          const targetElement = document.querySelector(
            this.selectors.UI_TARGET_ELEMENT
          );
          // Check if our button already exists to avoid duplicates
          const existingButton = document.getElementById('archive-button');

          if (targetElement && !existingButton) {
            const button = createArchiveButton(this);
            // Apply styling similar to other buttons in the header
            button.className =
              'goog-inline-block jfk-button jfk-button-standard docs-titlebar-button';
            button.style.marginRight = '8px'; // Add some space before the Share button

            // Insert our button directly into the DOM before the "Share" button
            targetElement.parentElement.insertBefore(button, targetElement);
          }
        };

        // Use a MutationObserver to re-inject the button if the UI dynamically changes
        const observer = new MutationObserver(updateButton);
        observer.observe(document.body, { childList: true, subtree: true });
        updateButton(); // Initial injection attempt
      },
    },
    // NEW: Add this complete object for Claude support
    {
      name: 'Claude',
      hostnames: ['claude.ai'],
      selectors: {
        UI_TARGET_ELEMENT: 'header .right-3',
        TURN_CONTAINER: 'div[data-test-render-count]',
        CONVERSATION_TITLE: '[data-testid="chat-menu-trigger"] .truncate',
        CANVAS_CONTAINER: 'div[class*="group/segmented-control"]',
        CANVAS_CONTENT: '.code-block__code',
      },
      // MODIFIED: This function now scrapes the main chat first, then appends canvas content.
      scrapeConversation: function () {
        const messages = [];

        // --- Step 1: Always scrape the normal chat history ---
        const turnElements = document.querySelectorAll(
          this.selectors.TURN_CONTAINER
        );
        turnElements.forEach(turn => {
          let role = '';
          let content = '';

          const userMessageElement = turn.querySelector(
            '[data-testid="user-message"]'
          );
          if (userMessageElement) {
            role = 'user';
            content = userMessageElement.innerText.trim();
          } else {
            const assistantMessageElement = turn.querySelector(
              '.font-claude-response'
            );
            if (assistantMessageElement) {
              role = 'model';
              content = assistantMessageElement.innerText.trim();
            }
          }

          if (role && content) {
            messages.push({ role, content });
          }
        });

        // --- Step 2: Check if the Canvas view is also open and append its content ---
        const canvasIdentifier = document.querySelector(
          this.selectors.CANVAS_CONTAINER
        );
        if (canvasIdentifier) {
          const canvasElement = document.querySelector(
            this.selectors.CANVAS_CONTENT
          );
          if (canvasElement) {
            const canvasContent = canvasElement.innerText.trim();
            if (canvasContent) {
              // Append the canvas content as the final message from the model
              messages.push({
                role: 'model',
                content: canvasContent,
              });
            }
          }
        }

        return messages;
      },
      injectUI: function () {
        const updateButtonPosition = () => {
          const targetElement = document.querySelector(
            this.selectors.UI_TARGET_ELEMENT
          );
          const portal = createPortalContainer();
          const button = createArchiveButton(this);

          if (targetElement) {
            if (!portal.contains(button)) {
              button.className =
                'inline-flex items-center justify-center relative shrink-0 can-focus select-none text-text-300 border-transparent transition font-ui tracking-tight duration-300 ease-[cubic-bezier(0.165,0.85,0.45,1)] hover:bg-bg-300 hover:text-text-100 h-9 px-2 rounded-lg active:scale-[0.985]';
              portal.appendChild(button);
            }

            const rect = targetElement.getBoundingClientRect();
            portal.style.top = `${rect.top + window.scrollY}px`;
            portal.style.left = `${rect.left + window.scrollX}px`;
            portal.style.transform = `translateX(calc(-100% - 8px))`;
            portal.style.display = 'block';
          } else {
            portal.style.display = 'none';
          }
        };

        const observer = new MutationObserver(updateButtonPosition);
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
        });
        updateButtonPosition();
      },
    },
    {
      name: 'NotebookLM',
      hostnames: ['notebooklm.google.com'],
      selectors: {
        // The span that holds the 'Refresh' and 'Configure' buttons is our target
        UI_TARGET_ELEMENT: '.panel-header .chat-header-buttons',
        // Selector for each complete user/model message pair
        TURN_CONTAINER: '.chat-message-pair',
        // Selector for the user's message text within a turn
        USER_MESSAGE: '.from-user-container .message-text-content',
        // Selector for the model's response text within a turn
        MODEL_MESSAGE: '.to-user-container .message-text-content',
        // CORRECTED: The container for the message's action buttons (Copy, Thumbs Up, etc.)
        MODEL_MESSAGE_ACTIONS:
          '.to-user-container .message-actions chat-actions',
        // The main H1 tag serves as the title
        CONVERSATION_TITLE: 'h1.notebook-title',
        SOURCE_PANEL_HEADER_ACTIONS: '.panel-header > div',
        SHARE_BUTTON: 'page-header .share-button',
        CHAT_INPUT: 'chat-input textarea',
      },
      // This function will be used later to get the chat data
      scrapeConversation: function () {
        const messages = [];
        const turnElements = document.querySelectorAll(
          this.selectors.TURN_CONTAINER
        );

        turnElements.forEach(turn => {
          const userElement = turn.querySelector(this.selectors.USER_MESSAGE);
          if (userElement) {
            messages.push({
              role: 'user',
              content: userElement.innerText.trim(),
            });
          }

          const modelElement = turn.querySelector(this.selectors.MODEL_MESSAGE);
          if (modelElement) {
            const clone = modelElement.cloneNode(true);

            const citationButtons = clone.querySelectorAll(
              'button.citation-marker'
            );
            citationButtons.forEach(button => {
              const span = button.querySelector('span[aria-label]');
              if (span) {
                const ariaLabel = span.getAttribute('aria-label');
                const citationText = ` [Source: ${ariaLabel}] `;
                button.replaceWith(citationText);
              }
            });

            // --- MODIFICATION START ---
            // Instead of using clone.innerText, we'll process the content block by block.
            const contentBlocks = [];

            // This selector finds all paragraphs, headings, and lists within the response.
            const blockElements = clone.querySelectorAll(
              'div[class*="paragraph"], ul, ol, li'
            );

            blockElements.forEach(el => {
              // Get the text from each individual block.
              const blockText = el.innerText.trim();
              if (blockText) {
                // Make sure not to add empty lines
                contentBlocks.push(blockText);
              }
            });

            // Join all the collected text blocks with double newlines to recreate paragraphs.
            const formattedContent = contentBlocks.join('\n\n');
            messages.push({ role: 'model', content: formattedContent });
            // --- MODIFICATION END ---
          }
        });
        return messages;
      },

      // This function handles creating and injecting our new buttons.
      // It now orchestrates calls to the global helper functions.
      injectUI: function () {
        const platform = this;
        const selectedMessages = new Set();
        let exportButton = null; // We will now manage the single export button

        // --- NEW: This function updates the button's appearance and behavior ---
        const updateExportButtonState = () => {
          if (!exportButton) return;
          const buttonLabel = exportButton.querySelector('.mdc-button__label');
          const buttonIcon = exportButton.querySelector('mat-icon');

          if (selectedMessages.size > 0) {
            buttonIcon.textContent = 'checklist';
            buttonLabel.textContent = `Export Selected (${selectedMessages.size})`;
            exportButton.setAttribute('aria-label', 'Export selected messages');
            // Ensure the dropdown part of the icon is hidden
            exportButton.querySelectorAll('mat-icon')[1].style.display = 'none';
          } else {
            buttonIcon.textContent = 'download';
            buttonLabel.textContent = 'Export';
            exportButton.setAttribute(
              'aria-label',
              'Export entire conversation'
            );
            // Ensure the dropdown icon is visible
            exportButton.querySelectorAll('mat-icon')[1].style.display =
              'inline-block';
          }
        };

        const nblm_createDownloadAllSourcesButton = () => {
          const button = document.createElement('button');
          button.id = 'kortex-download-all-sources-btn';
          button.className =
            'mdc-icon-button mat-mdc-icon-button mat-mdc-button-base mat-unthemed';
          button.setAttribute(
            'aria-label',
            'Download sources from this notebook'
          );
          button.setAttribute('title', 'Download sources from this notebook');
          button.innerHTML = `<mat-icon role="img" class="mat-icon notranslate material-symbols-outlined google-symbols mat-icon-no-color">download</mat-icon>`;

          button.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();

            const notebookIdMatch = window.location.pathname.match(
              /\/notebook\/([a-fA-F0-9-]+)/
            );
            if (!notebookIdMatch) {
              alert(
                'Kortex: Could not determine the Notebook ID from the URL.'
              );
              return;
            }
            const notebookId = notebookIdMatch[1];

            // --- THIS IS THE NEW LOGIC ---
            // Instead of creating a window, we send a message to the background script.
            chrome.runtime.sendMessage({
              type: 'OPEN_DOWNLOAD_POPUP',
              data: { notebookId },
            });
          });
          return button;
        };

        // --- Main function to add all our custom UI ---
        const addCustomButtons = async () => {
          const target = document.querySelector(
            platform.selectors.UI_TARGET_ELEMENT
          );
          if (target) {
            if (!document.getElementById('kortex-copy-chat')) {
              const copyButton = nblm_createCopyButton(platform);
              const exportButtonContainer = nblm_createExportButton(platform);
              exportButton = exportButtonContainer.querySelector('button');

              exportButton.onclick = event => {
                event.stopPropagation();

                if (selectedMessages.size > 0) {
                  // --- Define the handler for EXPORTING SELECTED turns ---
                  const handleSelectedExport = async (format, extension) => {
                    const title = getConversationTitle(platform);
                    const date = new Date().toISOString().split('T')[0];
                    const filename = `${title} - Curated Briefing - ${date}.${extension}`;

                    // --- MODIFIED LOGIC START ---
                    // Now, we process each selected turn (user + model pair)
                    const messageArray = [];
                    selectedMessages.forEach(turnElement => {
                      const userElement = turnElement.querySelector(
                        platform.selectors.USER_MESSAGE
                      );
                      const modelElement = turnElement.querySelector(
                        platform.selectors.MODEL_MESSAGE
                      );

                      if (userElement) {
                        messageArray.push({
                          role: 'user',
                          content: userElement.innerText.trim(),
                        });
                      }
                      if (modelElement) {
                        messageArray.push({
                          role: 'model',
                          content: modelElement.innerText.trim(),
                        });
                      }
                    });
                    // --- MODIFIED LOGIC END ---
                    if (format === 'pdf') {
                      const markdownContent =
                        header + nblm_formatters.md(messageArray);
                      const pdfBlob = await nblm_generateMarkdownPdf(
                        markdownContent
                      );
                      if (pdfBlob) nblm_downloadBlob(pdfBlob, filename);
                    } else {
                      // --- EXISTING LOGIC ---
                      const header = `Curated Briefing from "${title}"\nExported on: ${new Date().toLocaleString()}\n\n---\n\n`;
                      const formattedMessages =
                        nblm_formatters[format](messageArray);
                      const finalContent =
                        format === 'json'
                          ? formattedMessages
                          : header + formattedMessages;
                      nblm_triggerDownload(
                        finalContent,
                        filename,
                        `text/${format}`
                      );
                    }
                  };
                  nblm_toggleExportDropdown(
                    exportButtonContainer,
                    handleSelectedExport
                  );
                } else {
                  // --- Define the handler for EXPORTING ALL messages ---
                  const handleAllExport = async (format, extension) => {
                    const title = getConversationTitle(platform).replace(
                      /[<>:"/\\|?*]/g,
                      '_'
                    );
                    const date = new Date().toISOString().split('T')[0];
                    const filename = `${title} - ${date}.${extension}`;

                    if (format === 'pdf') {
                      const conversation = platform.scrapeConversation();
                      const markdownContent = nblm_formatters.md(conversation);
                      const pdfBlob = await nblm_generateMarkdownPdf(
                        markdownContent
                      );
                      if (pdfBlob) nblm_downloadBlob(pdfBlob, filename);
                    } else {
                      // This is your original, correct logic for non-PDF
                      nblm_handleExportOptionClick(platform, format, extension);
                    }

                    if (UI_STATE.exportDropdownMenu)
                      UI_STATE.exportDropdownMenu.remove();
                  };

                  nblm_toggleExportDropdown(
                    exportButtonContainer,
                    handleAllExport
                  );
                }
              };

              target.prepend(exportButtonContainer);
              target.prepend(copyButton);
            }
          }


          // MODIFIED: Target the new header location
          const headerActionsContainer = document.querySelector(
            platform.selectors.SOURCE_PANEL_HEADER_ACTIONS
          );
          if (
            headerActionsContainer &&
            !document.getElementById('kortex-download-all-sources-btn')
          ) {
            const downloadAllButton = nblm_createDownloadAllSourcesButton();
            // Prepend to add it before the existing dock icon
            headerActionsContainer.prepend(downloadAllButton);
          }

          // Inject "Select" buttons into model responses
          const modelMessageActions = document.querySelectorAll(
            platform.selectors.MODEL_MESSAGE_ACTIONS
          );
          modelMessageActions.forEach(actionsContainer => {
            if (actionsContainer.querySelector('.kortex-select-button')) return;

            // --- MODIFIED: We now select the entire turn, not just the message ---
            const turnElement = actionsContainer.closest(
              platform.selectors.TURN_CONTAINER
            );

            const selectButton = document.createElement('button');
            selectButton.className =
              'mdc-icon-button mat-mdc-icon-button mat-mdc-button-base action-button mat-unthemed kortex-select-button';
            selectButton.setAttribute('aria-label', 'Select this message');

            const icon = document.createElement('mat-icon');
            icon.className =
              'mat-icon notranslate google-symbols mat-icon-no-color';
            icon.textContent = 'check_box_outline_blank';
            selectButton.appendChild(icon);

            let isSelected = false;
            selectButton.addEventListener('click', () => {
              isSelected = !isSelected;
              if (isSelected) {
                icon.textContent = 'check_box';
                selectButton.style.color = '#1a73e8';
                selectedMessages.add(turnElement); // Add the whole turn to the Set
              } else {
                icon.textContent = 'check_box_outline_blank';
                selectButton.style.color = 'inherit';
                selectedMessages.delete(turnElement); // Remove the whole turn from the Set
              }
              updateExportButtonState();
            });

            actionsContainer.prepend(selectButton);
          });

          // --- NEW FEATURE: Inject Export Button into Studio Panel (Notes) ---
          const artifactViewer = document.querySelector('artifact-viewer');
          if (
            artifactViewer &&
            !artifactViewer.querySelector('.kortex-export-note-button')
          ) {
            const header = artifactViewer.querySelector('.artifact-header');
            // Find the copy button inside the artifact viewer
            const copyButton = artifactViewer.querySelector(
              'button[mattooltip="Copy content with formatting"]'
            );

            if (header && copyButton) {
              const exportNoteContainer = document.createElement('div');
              exportNoteContainer.style.position = 'relative';

              // Clone the copy button to match style
              const exportNoteButton = copyButton.cloneNode(true);
              exportNoteButton.classList.add('kortex-export-note-button'); // Add our class
              exportNoteButton.setAttribute('mattooltip', 'Export note');
              exportNoteButton.setAttribute('aria-label', 'Export note');

              // Change icon
              const icon = exportNoteButton.querySelector('mat-icon');
              if (icon) icon.textContent = 'download';

              exportNoteContainer.appendChild(exportNoteButton);

              // Insert our new button container right after the existing copy button
              copyButton.insertAdjacentElement('afterend', exportNoteContainer);

              // Add click listener
              exportNoteButton.addEventListener('click', e => {
                e.stopPropagation();

                // This handler will be passed to the dropdown
                const handleNoteExport = async (format, extension) => {
                  // Scrape the content from the panel
                  const noteData = nblm_scrapeNoteContent(artifactViewer);
                  if (!noteData) {
                    alert('Kortex: Could not scrape note content.');
                    return;
                  }

                  // Format the filename
                  const title = noteData.title.replace(/[<>:"/\\|?*]/g, '_');
                  const date = new Date().toISOString().split('T')[0];
                  const filename = `${title} - ${date}.${extension}`;

                  if (format === 'pdf') {
                    // We use the note formatter to get MD, then add the title at the top
                    const markdownContent = `# ${
                      noteData.title
                    }\n\n${nblm_note_formatters.md(noteData)}`;
                    const pdfBlob = await nblm_generateMarkdownPdf(
                      markdownContent
                    );
                    if (pdfBlob) nblm_downloadBlob(pdfBlob, filename);
                  } else {
                    // --- EXISTING LOGIC ---
                    const formattedContent =
                      nblm_note_formatters[format](noteData);
                    nblm_triggerDownload(
                      formattedContent,
                      filename,
                      `text/${format}`
                    );
                  }

                  // Dropdown closes itself via its own item click listener
                };

                // Reuse the existing dropdown toggle function
                nblm_toggleExportDropdown(
                  exportNoteContainer,
                  handleNoteExport
                );
              });
            }
          }
        };

        const observer = new MutationObserver(addCustomButtons);
        observer.observe(document.body, { childList: true, subtree: true });
        addCustomButtons();
      },
    },

    // In src/content_script.js, replace the old NotebookLM-Dashboard object with this one.
    {
      name: 'NotebookLM-Dashboard',
      hostnames: ['notebooklm.google.com'],
      selectors: {
        NOTEBOOK_ITEM: 'project-button',
        MORE_OPTIONS_BUTTON: 'button.project-button-more',
        TITLE_SPAN: '.project-button-title',
      },
      injectUI: function () {
        // --- NEW: Perform a one-time cleanup when the script first loads ---
        // This runs immediately and safely removes any UI left over from a previous page view.
        const oldFab = document.getElementById('kortex-fab-container');
        if (oldFab) oldFab.remove();
        // Use a timeout to ensure the notebook items have had a chance to render before we check them
        setTimeout(() => {
          document.querySelectorAll('project-button').forEach(item => {
            const oldCheckbox = findInNode(item, '.kortex-checkbox');
            if (oldCheckbox) oldCheckbox.remove();
          });
        }, 0);

        // --- The rest of the injection logic remains inside the observer ---
        const selectedNotebooks = new Set();
        let deleteButton = null;

        const updateDeleteButton = () => {
          if (!deleteButton) return;
          if (selectedNotebooks.size > 0) {
            deleteButton.style.display = 'flex';
            deleteButton.querySelector(
              'span'
            ).textContent = `Delete (${selectedNotebooks.size})`;
          } else {
            deleteButton.style.display = 'none';
          }
        };

        const addBulkDeleteUI = () => {
          // --- NEW: URL-aware visibility logic ---
          const fabContainer = document.getElementById('kortex-fab-container');

          if (window.location.pathname !== '/') {
            // If we are NOT on the dashboard, ensure the floating button is removed.
            if (fabContainer) {
              fabContainer.remove();
            }
            // Also remove any lingering checkboxes
            document
              .querySelectorAll('.kortex-checkbox')
              .forEach(cb => cb.remove());
            // --- FIX: clear state when leaving dashboard ---
            selectedNotebooks.clear();
            // No need to call updateDeleteButton() here, as the button is part of fabContainer
            return; // Stop execution for non-dashboard pages
          }

          // If we ARE on the dashboard, proceed with the normal injection logic.

          // Create the floating container if it doesn't exist
          if (!fabContainer) {
            const newFabContainer = document.createElement('div');
            newFabContainer.id = 'kortex-fab-container';
            applyStyles(newFabContainer, {
              position: 'fixed',
              bottom: '30px',
              right: '30px',
              zIndex: '10000',
            });

            deleteButton = document.createElement('button');
            deleteButton.id = 'kortex-bulk-delete-btn';
            deleteButton.innerHTML = `<mat-icon role="img" class="mat-icon notranslate google-symbols mat-icon-no-color" style="color: white;">delete</mat-icon><span style="margin-left: 8px;">Delete</span>`;
            applyStyles(deleteButton, {
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '16px',
              padding: '12px 20px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
            });

            deleteButton.addEventListener('click', async () => {
              if (selectedNotebooks.size === 0) return;
              if (
                confirm(
                  `Are you sure you want to delete ${selectedNotebooks.size} notebook(s)?`
                )
              ) {
                deleteButton.querySelector('span').textContent = 'Deleting...';
                const response = await sendMessageToBackground(
                  'DELETE_NOTEBOOKS',
                  { ids: Array.from(selectedNotebooks) }
                );
                if (response.success) {
                  location.reload();
                } else {
                  alert(`An error occurred: ${response.message}`);
                  updateDeleteButton();
                }
              }
            });

            newFabContainer.appendChild(deleteButton);
            document.body.appendChild(newFabContainer);
          }

          // Inject checkboxes
          const notebookItems = document.querySelectorAll(
            this.selectors.NOTEBOOK_ITEM
          );
          notebookItems.forEach(item => {
            if (findInNode(item, '.kortex-checkbox')) return;

            const moreOptionsButton = findInNode(
              item,
              this.selectors.MORE_OPTIONS_BUTTON
            );
            const titleSpan = findInNode(item, this.selectors.TITLE_SPAN);

            if (moreOptionsButton && titleSpan && titleSpan.id) {
              const notebookId = titleSpan.id.replace('-title', '');
              const checkbox = document.createElement('input');
              checkbox.type = 'checkbox';
              checkbox.className = 'kortex-checkbox';
              applyStyles(checkbox, {
                width: '20px',
                height: '20px',
                marginRight: '100px',
                cursor: 'pointer',
              });

              checkbox.addEventListener('click', e => e.stopPropagation());
              checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                  selectedNotebooks.add(notebookId);
                } else {
                  selectedNotebooks.delete(notebookId);
                }
                updateDeleteButton();
              });
              moreOptionsButton.parentElement.insertBefore(
                checkbox,
                moreOptionsButton
              );
            }
          });
        };

        const observer = new MutationObserver(addBulkDeleteUI);
        observer.observe(document.body, { childList: true, subtree: true });
      },
    },
    // NEW: Add this complete object for Perplexity support
    {
      name: 'Perplexity',
      hostnames: ['perplexity.ai'],
      selectors: {
        // MODIFIED: Switched to the thread-dropdown-menu button as the anchor.
        UI_TARGET_ELEMENT: 'button[data-testid="thread-dropdown-menu"]',
        // NOTE: The following selectors are placeholders for the next step.
        CONVERSATION_TITLE: '.group\\/title',
        ASSISTANT_RESPONSE: 'div.prose',
      },
      scrapeConversation: function () {
        const messages = [];
        // Perplexity has a distinct prompt-then-answer structure.

        // 1. Scrape the user prompt. We re-use the CONVERSATION_TITLE selector here.
        const userPromptElement = document.querySelector(
          this.selectors.CONVERSATION_TITLE
        );
        if (userPromptElement) {
          messages.push({
            role: 'user',
            content: userPromptElement.innerText.trim(),
          });
        }

        // 2. Scrape the assistant's response.
        // A response can have multiple 'prose' blocks, so we find all and join them.
        const assistantResponseElements = document.querySelectorAll(
          this.selectors.ASSISTANT_RESPONSE
        );
        if (assistantResponseElements.length > 0) {
          let fullResponse = [];
          assistantResponseElements.forEach(el => {
            fullResponse.push(el.innerText.trim());
          });

          messages.push({
            role: 'model',
            content: fullResponse.join('\n\n'),
          });
        }

        return messages;
      },
      injectUI: function () {
        const updateButtonPosition = () => {
          // Find the anchor button first.
          const anchorButton = document.querySelector(
            this.selectors.UI_TARGET_ELEMENT
          );
          // From the anchor, find the parent container that holds all action buttons.
          const targetElement = anchorButton
            ? anchorButton.closest('div[class*="gap-x-sm"]')
            : null;

          const portal = createPortalContainer();
          const button = createArchiveButton(this);

          if (targetElement) {
            if (!portal.contains(button)) {
              // Apply classes from Perplexity's existing buttons to match the style.
              button.className =
                'focus-visible:bg-offsetPlus hover:bg-offsetPlus text-quiet hover:text-foreground dark:hover:bg-offsetPlus font-sans focus:outline-none outline-none outline-transparent transition duration-300 ease-out select-none items-center relative group/button justify-center text-center rounded-lg cursor-pointer active:scale-[0.97] origin-center whitespace-nowrap inline-flex text-sm h-8';
              button.style.padding = '0 8px';
              portal.appendChild(button);
            }

            // Position the portal to the left of the other action buttons.
            const rect = targetElement.getBoundingClientRect();
            portal.style.top = `${rect.top + window.scrollY}px`;
            portal.style.left = `${rect.left + window.scrollX}px`;
            portal.style.transform = `translateX(calc(-100% - 4px))`; // Nudge it left with 4px gap
            portal.style.display = 'block';
          } else {
            portal.style.display = 'none';
          }
        };

        const observer = new MutationObserver(updateButtonPosition);
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
        });
        updateButtonPosition();
      },
    },
  ];

  // ======================================================================
  // 3. NOTEBOOKLM-SPECIFIC UI HELPERS
  // ======================================================================

  // --- NEW: Scraper for the Studio Panel (Notes) ---
  function nblm_scrapeNoteContent (noteElement) {
    try {
      const titleInput = noteElement.querySelector('input.artifact-title');
      const title = titleInput ? titleInput.value : 'Untitled Note';

      const contentContainer = noteElement.querySelector('.artifact-content');
      if (!contentContainer) return { title, content: [] };

      // Find all content blocks
      const blocks = contentContainer.querySelectorAll(
        'div[class^="paragraph "]'
      );
      const contentArray = [];

      blocks.forEach(block => {
        let blockType = 'normal';
        if (block.classList.contains('heading1')) blockType = 'h1';
        else if (block.classList.contains('heading2')) blockType = 'h2';
        else if (block.classList.contains('heading3')) blockType = 'h3';
        else if (block.classList.contains('heading4')) blockType = 'h4';

        const segments = [];
        // Iterate through all child nodes to capture text and formatted elements
        block.childNodes.forEach(node => {
          let segment = { type: 'text', content: '' };

          if (node.nodeType === Node.TEXT_NODE) {
            segment.content = node.textContent;
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            switch (node.nodeName) {
              case 'SPAN':
                segment.content = node.textContent;
                break;
              case 'B':
                segment.type = 'bold';
                segment.content = node.textContent;
                break;
              case 'I':
                segment.type = 'italic';
                segment.content = node.textContent;
                break;
              case 'CODE':
                segment.type = 'code';
                segment.content = node.textContent;
                break;
              default:
                // Fallback for other potential wrapper elements
                if (node.textContent) {
                  segment.content = node.textContent;
                }
                break;
            }
          }

          // Add segment only if it has content
          if (segment.content) {
            segments.push(segment);
          }
        });

        // Only add the block if it resulted in segments
        if (segments.length > 0) {
          // Join adjacent text segments
          const joinedSegments = [];
          segments.forEach(seg => {
            const last = joinedSegments[joinedSegments.length - 1];
            if (last && last.type === 'text' && seg.type === 'text') {
              last.content += seg.content;
            } else {
              joinedSegments.push(seg);
            }
          });
          contentArray.push({ type: blockType, segments: joinedSegments });
        }
      });

      return { title, content: contentArray };
    } catch (error) {
      console.error('Kortex: Failed to scrape note content.', error);
      return null;
    }
  }

  function nblm_createExportSelectedButton () {
    const button = document.createElement('button');
    button.id = 'kortex-export-selected-chat';
    button.className =
      'mdc-button mat-mdc-button-base mdc-button--outlined mat-mdc-outlined-button mat-unthemed';
    button.disabled = true; // Disabled by default
    button.innerHTML = `
        <mat-icon role="img" class="mat-icon notranslate material-symbols-outlined google-symbols mat-icon-no-color">checklist</mat-icon>
        <span class="mdc-button__label">Export Selected</span>
    `;
    applyStyles(button, {
      marginRight: '8px',
      transition: 'opacity 0.2s ease',
      opacity: '0.5',
    });
    return button;
  }

  const nblm_formatters = {
    txt: conversation => {
      if (!conversation || conversation.length === 0) return '';
      return conversation
        .map(
          turn =>
            `${turn.role.charAt(0).toUpperCase() + turn.role.slice(1)}:\n${
              turn.content
            }`
        )
        .join('\n\n---\n\n');
    },
    md: conversation => {
      if (!conversation || conversation.length === 0) return '';
      return conversation
        .map(turn =>
          turn.role === 'user'
            ? `### User\n\n${turn.content}`
            : `### Model\n\n${turn.content
                .split('\n')
                .map(line => `> ${line}`)
                .join('\n')}`
        )
        .join('\n\n---\n\n');
    },
    json: conversation => JSON.stringify(conversation, null, 2),
  };

  // --- NEW: Formatters for scraped note content ---
  const nblm_note_formatters = {
    txt: note => {
      if (!note || !note.content) return '';
      return note.content
        .map(block => {
          // Just join all segments' text content for a single line
          return block.segments.map(seg => seg.content).join('');
        })
        .join('\n\n'); // Join blocks with double newline
    },
    md: note => {
      if (!note || !note.content) return '';
      return note.content
        .map(block => {
          let prefix = '';
          switch (block.type) {
            case 'h1':
              prefix = '# ';
              break;
            case 'h2':
              prefix = '## ';
              break;
            case 'h3':
              prefix = '### ';
              break;
            case 'h4':
              prefix = '#### ';
              break;
          }

          const line = block.segments
            .map(seg => {
              switch (seg.type) {
                case 'bold':
                  return `**${seg.content}**`;
                case 'italic':
                  return `*${seg.content}*`;
                case 'code':
                  return `\`${seg.content}\``;
                default:
                  return seg.content;
              }
            })
            .join('');

          return prefix + line;
        })
        .join('\n\n'); // Join blocks with double newline
    },
    json: note => JSON.stringify(note, null, 2),
  };

  function nblm_triggerDownload (content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function nblm_handleCopyClick (platform, button, originalContent) {
    const conversation = platform.scrapeConversation();
    if (conversation.length === 0) {
      shakeElement(button);
      button.querySelector('.mdc-button__label').textContent = 'No Chat!';
      setTimeout(() => (button.innerHTML = originalContent), 2000);
      return;
    }
    const formattedText = nblm_formatters.txt(conversation);
    navigator.clipboard
      .writeText(formattedText)
      .then(() => {
        button.querySelector('.mdc-button__label').textContent = 'Copied!';
        button.style.backgroundColor = '#28a745';
        setTimeout(() => {
          button.innerHTML = originalContent;
          button.style.backgroundColor = '';
        }, 2000);
      })
      .catch(err => {
        console.error('Kortex: Failed to copy chat.', err);
        button.querySelector('.mdc-button__label').textContent = 'Failed!';
        button.style.backgroundColor = '#dc3545';
        setTimeout(() => {
          button.innerHTML = originalContent;
          button.style.backgroundColor = '';
        }, 2000);
      });
  }

  function nblm_handleExportOptionClick (platform, format, extension) {
    const title = getConversationTitle(platform).replace(/[<>:"/\\|?*]/g, '_');
    const date = new Date().toISOString().split('T')[0];
    const filename = `${title} - ${date}.${extension}`;
    const conversation = platform.scrapeConversation();
    const content = nblm_formatters[format](conversation);
    nblm_triggerDownload(content, filename, `text/${format}`);
  }

  // >>>>> ADD THIS NEW FUNCTION <<<<<
  /**
   * Generates a multi-page, formatted PDF from a Markdown string.
   * @param {string} markdownContent - The markdown string to render.
   * @returns {Promise<Blob>} A promise that resolves with the generated PDF Blob.
   */
  async function nblm_generateMarkdownPdf (markdownContent) {
    // This function assumes jsPDF is available on the window object
    if (!window.jspdf) {
      console.error(
        "Kortex: jsPDF library not found. Make sure it's injected correctly."
      );
      alert('Kortex Error: PDF library not found.');
      return null;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // --- PDF Styling Configuration ---
    const PAGE_WIDTH = doc.internal.pageSize.getWidth();
    const MARGIN = 15;
    const MAX_WIDTH = PAGE_WIDTH - MARGIN * 2;
    const FONT_SIZES = { h1: 18, h2: 16, h3: 14, body: 11 };

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
      let processed = false;

      if (line.startsWith('# ')) {
        const text = line.substring(2);
        checkPageBreak(FONT_SIZES.h1);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(FONT_SIZES.h1);
        const splitText = doc.splitTextToSize(text, MAX_WIDTH);
        doc.text(splitText, MARGIN, cursorY);
        cursorY += splitText.length * FONT_SIZES.h1 * 0.5 + 2; // Add spacing
        processed = true;
      } else if (line.startsWith('## ')) {
        const text = line.substring(3);
        checkPageBreak(FONT_SIZES.h2);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(FONT_SIZES.h2);
        const splitText = doc.splitTextToSize(text, MAX_WIDTH);
        doc.text(splitText, MARGIN, cursorY);
        cursorY += splitText.length * FONT_SIZES.h2 * 0.5 + 2;
        processed = true;
      } else if (line.startsWith('### ')) {
        const text = line.substring(4);
        checkPageBreak(FONT_SIZES.h3);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(FONT_SIZES.h3);
        const splitText = doc.splitTextToSize(text, MAX_WIDTH);
        doc.text(splitText, MARGIN, cursorY);
        cursorY += splitText.length * FONT_SIZES.h3 * 0.5 + 2;
        processed = true;
      } else if (line.startsWith('> ')) {
        const text = line.substring(2);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(FONT_SIZES.body);
        const splitText = doc.splitTextToSize(text, MAX_WIDTH - 5); // Indent
        checkPageBreak(splitText.length * FONT_SIZES.body * 0.5);

        // Draw a vertical line for the blockquote
        doc.setDrawColor(200, 200, 200); // Light grey
        doc.rect(
          MARGIN,
          cursorY - FONT_SIZES.body * 0.4,
          1,
          splitText.length * FONT_SIZES.body * 0.5 + 2
        );

        doc.setTextColor(100, 100, 100); // Grey text
        doc.text(splitText, MARGIN + 5, cursorY); // Indented text
        doc.setTextColor(0, 0, 0); // Reset text color

        cursorY += splitText.length * FONT_SIZES.body * 0.5 + 3;
        processed = true;
      } else if (line.trim() === '---') {
        checkPageBreak(10);
        doc.setDrawColor(150, 150, 150);
        doc.line(MARGIN, cursorY, PAGE_WIDTH - MARGIN, cursorY); // Horizontal line
        cursorY += 5;
        processed = true;
      } else if (line.trim().length > 0) {
        // Standard paragraph text
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(FONT_SIZES.body);
        const splitText = doc.splitTextToSize(line, MAX_WIDTH);
        checkPageBreak(splitText.length * FONT_SIZES.body * 0.5);
        doc.text(splitText, MARGIN, cursorY);
        cursorY += splitText.length * FONT_SIZES.body * 0.5 + 3; // Line spacing
        processed = true;
      }

      if (processed) {
        cursorY += 2; // Add a bit of space after every element
      }
    }

    return doc.output('blob');
  }

  // >>>>> ADD THIS NEW HELPERFUNCTION <<<<<
  // (This one is for downloading blobs from the content script)
  function nblm_downloadBlob (blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function nblm_toggleExportDropdown (container, exportHandler) {
    if (UI_STATE.exportDropdownMenu) {
      UI_STATE.exportDropdownMenu.remove();
      UI_STATE.exportDropdownMenu = null;
      return;
    }
    const menu = document.createElement('div');
    UI_STATE.exportDropdownMenu = menu;
    applyStyles(menu, {
      fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
      position: 'absolute',
      top: '110%',
      right: '0',
      backgroundColor: getSystemTheme() === 'dark' ? '#2f2f2f' : '#ffffff',
      color: getSystemTheme() === 'dark' ? 'white' : '#333',
      borderRadius: '8px',
      boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
      zIndex: '10001',
      width: '220px',
      border: '1px solid #555',
    });

    const createMenuItem = (text, format, extension) => {
      const item = document.createElement('div');
      item.textContent = text;
      applyStyles(item, {
        padding: '12px',
        cursor: 'pointer',
        fontSize: '14px',
      });
      item.onmouseenter = () =>
        (item.style.backgroundColor =
          getSystemTheme() === 'dark' ? '#4a4a4a' : '#f0f0f0');
      item.onmouseleave = () => (item.style.backgroundColor = 'transparent');
      // This now calls the generic handler function we passed in
      item.onclick = e => {
        e.stopPropagation(); // Stop the click from closing the menu instantly
        exportHandler(format, extension);
        // Close the menu after a selection is made
        if (UI_STATE.exportDropdownMenu) {
          UI_STATE.exportDropdownMenu.remove();
          UI_STATE.exportDropdownMenu = null;
        }
      };
      return item;
    };

    menu.appendChild(createMenuItem('Export as Markdown (.md)', 'md', 'md'));
    menu.appendChild(
      createMenuItem('Export as Plain Text (.txt)', 'txt', 'txt')
    );
    // menu.appendChild(createMenuItem('Export as PDF (.pdf)', 'pdf', 'pdf'));

    menu.appendChild(createMenuItem('Export as JSON (.json)', 'json', 'json'));

    container.appendChild(menu);

    setTimeout(() => {
      document.addEventListener(
        'click',
        e => {
          if (UI_STATE.exportDropdownMenu && !menu.contains(e.target)) {
            UI_STATE.exportDropdownMenu.remove();
            UI_STATE.exportDropdownMenu = null;
          }
        },
        { once: true, capture: true }
      ); // Use capture to catch it before it bubbles
    }, 0);
  }

  function nblm_createCopyButton (platform) {
    const button = document.createElement('button');
    button.id = 'kortex-copy-chat';
    button.className =
      'mdc-button mat-mdc-button-base mdc-button--outlined mat-mdc-outlined-button mat-unthemed';
    const originalContent = `<mat-icon role="img" class="mat-icon notranslate material-symbols-outlined google-symbols mat-icon-no-color">copy_all</mat-icon><span class="mdc-button__label">Copy</span>`;
    button.innerHTML = originalContent;
    applyStyles(button, {
      marginRight: '8px',
      transition: 'background-color 0.3s ease',
    });
    button.onclick = () =>
      nblm_handleCopyClick(platform, button, originalContent);
    return button;
  }

  function nblm_createExportButton (platform) {
    const container = document.createElement('div');
    container.style.position = 'relative';
    const button = document.createElement('button');
    button.id = 'kortex-export-chat-button';
    button.className =
      'mdc-button mat-mdc-button-base mdc-button--outlined mat-mdc-outlined-button mat-unthemed';
    button.innerHTML = `<mat-icon role="img" class="mat-icon notranslate material-symbols-outlined google-symbols mat-icon-no-color">download</mat-icon><span class="mdc-button__label">Export</span><mat-icon role="img" class="mat-icon notranslate material-symbols-outlined google-symbols mat-icon-no-color">arrow_drop_down</mat-icon>`;
    button.style.marginRight = '8px';

    // This click handler is now set inside injectUI
    // button.onclick = (event) => {
    //     event.stopPropagation();
    //     nblm_toggleExportDropdown(platform, container);
    // };

    container.appendChild(button);
    return container;
  }

  








  // ======================================================================
  // 3.1 HELPER & UTILITY FUNCTIONS
    // ======================================================================











 




  /**
   * Creates and triggers a download for a PDF generated from plain text.
   * @param {string} filename - The desired filename (e.g., "My Note.pdf")
   * @param {string} textContent - The raw text content to put in the PDF.
   */
  function nblm_downloadAsPdf (filename, textContent) {
    try {
      // 1. Access jsPDF (it was injected by the manifest)
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      // 2. Add text, handling line breaks and page width
      // We use a slightly different title-then-content format here
      const title = filename.replace('.pdf', '');
      doc.setFont('helvetica', 'bold');
      doc.text(title, 10, 10);

      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(textContent, 180); // 180mm width
      doc.text(lines, 10, 20); // Start text lower down

      // 3. Trigger the download
      doc.save(filename);
    } catch (e) {
      console.error('Kortex: Failed to generate PDF.', e);
      alert(
        'Kortex: Failed to generate PDF. Make sure jsPDF is installed correctly.'
      );
    }
  }

  /**
   * Finds an element within a node, piercing the Shadow DOM if it exists.
   * @param {Node} node - The parent node to search within.
   * @param {string} selector - The CSS selector to find.
   * @returns {Element|null}
   */
  function findInNode (node, selector) {
    // First, try searching in the element's shadow root if it exists.
    if (node.shadowRoot) {
      const found = node.shadowRoot.querySelector(selector);
      if (found) return found;
    }
    // Otherwise, search the element's regular children.
    return node.querySelector(selector);
  }

  function getConversationTitle (platform) {
    if (platform.selectors.CONVERSATION_TITLE) {
      const titleElement = document.querySelector(
        platform.selectors.CONVERSATION_TITLE
      );
      if (titleElement) {
        // NEW: Handle input fields for titles (like in Google Docs)
        if (titleElement.tagName.toLowerCase() === 'input') {
          return titleElement.value.trim();
        }
        // The element contains the title text and a child div for the fade effect.
        // Cloning the node and removing the child is a safe way to get only the parent's text.
        const clone = titleElement.cloneNode(true);
        const childDiv = clone.querySelector('.conversation-title-cover');
        if (childDiv) {
          childDiv.remove();
        }
        return clone.innerText.trim();
      }
    }
    // Fallback for platforms that use the document's title (like ChatGPT)
    return document.title;
  }

  function applyStyles (element, styles) {
    for (const key in styles) {
      element.style[key] = styles[key];
    }
  }

  function getSystemTheme () {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  // Injects CSS for the shake animation
  function addAnimationStyles () {
    const styleSheet = document.createElement('style');
    styleSheet.type = 'text/css';
    styleSheet.innerText = `
            @keyframes nexus-shake-animation {
                10%, 90% { transform: translateX(-1px); }
                20%, 80% { transform: translateX(2px); }
                30%, 50%, 70% { transform: translateX(-4px); }
                40%, 60% { transform: translateX(4px); }
            }
            .nexus-shake {
                animation: nexus-shake-animation 0.5s ease-in-out;
            }
        `;
    document.head.appendChild(styleSheet);
  }

  // Applies the shake animation class to an element
  function shakeElement (element) {
    element.classList.add('nexus-shake');
    setTimeout(() => {
      element.classList.remove('nexus-shake');
    }, 500);
  }

  const sendMessageToBackground = (type, data = null) => {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type, data }, response => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        resolve(response);
      });
    });
  };

  function detectCurrentPlatform () {
    const currentHostname = window.location.hostname;
    return platforms.find(p =>
      p.hostnames.some(h => currentHostname.includes(h))
    );
  }

  // ======================================================================
  // 4. UI CREATION & MANAGEMENT
  // ======================================================================

  // REMOVED: The showTemporaryTooltip function is no longer needed.

  // MODIFIED: The 'true' argument is removed to match the listener's registration.
  function closeDropdown () {
    if (UI_STATE.dropdownMenu) {
      UI_STATE.dropdownMenu.remove();
      UI_STATE.dropdownMenu = null;
      // The arguments here must exactly match addEventListener to work correctly.
      document.removeEventListener('click', closeDropdown);
    }
  }

  // MODIFIED: This function can now render HTML for icons, not just text.
  function createDropdownItem (options) {
    // The 'isHtmlIcon' property is new
    const { id, icon, text, isDark, isHtmlIcon = false } = options;
    const item = document.createElement('div');
    item.className = 'nexus-dd-item';
    if (id) item.dataset.id = id;

    const iconSpan = document.createElement('span');
    applyStyles(iconSpan, { fontSize: '1.2em', marginRight: '10px' });

    // Use innerHTML for Font Awesome icons, otherwise use textContent
    if (isHtmlIcon) {
      iconSpan.innerHTML = icon;
    } else {
      iconSpan.textContent = icon;
    }

    item.appendChild(iconSpan);
    item.appendChild(document.createTextNode(text));

    applyStyles(item, {
      padding: '12px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      fontSize: '14px',
    });

    item.addEventListener(
      'mouseenter',
      () => (item.style.backgroundColor = isDark ? '#4a4a4a' : '#f0f0f0')
    );
    item.addEventListener(
      'mouseleave',
      () => (item.style.backgroundColor = 'transparent')
    );

    return item;
  }

  // NEW: Handles rendering the second step of the dropdown (the notebook list).
  // MODIFIED: This function is rebuilt with a fixed header containing a back button and search bar.
  // MODIFIED: Added 'display: block' to the SVG to ensure perfect centering.
  async function populateNotebookListView (
    viewContainer,
    isDark,
    handleItemClick
  ) {
    // This check prevents re-fetching the list every time.
    if (viewContainer.dataset.populated === 'true') {
      const searchInput = viewContainer.querySelector('input');
      if (searchInput) searchInput.value = '';
      viewContainer
        .querySelectorAll('.nexus-dd-item[data-id]')
        .forEach(item => (item.style.display = 'flex'));
      return;
    }
    viewContainer.dataset.populated = 'true';
    viewContainer.innerHTML = '';

    // --- 1. Header Row ---
    const headerRow = document.createElement('div');
    applyStyles(headerRow, {
      display: 'flex',
      alignItems: 'center',
      padding: '8px 12px',
      gap: '8px',
    });

    // Back button with perfectly centered icon
    const backButton = document.createElement('div');
    backButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width: 20px; height: 20px; display: block;"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" /></svg>`;

    applyStyles(backButton, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      cursor: 'pointer',
      flexShrink: '0',
    });

    // Add manual hover effect
    backButton.addEventListener(
      'mouseenter',
      () => (backButton.style.backgroundColor = isDark ? '#4a4a4a' : '#f0f0f0')
    );
    backButton.addEventListener(
      'mouseleave',
      () => (backButton.style.backgroundColor = 'transparent')
    );

    backButton.addEventListener('click', e => {
      e.stopPropagation();
      const menu = viewContainer.parentElement;
      menu.querySelector('.nexus-initial-view').style.display = 'block';
      viewContainer.style.display = 'none';
    });
    headerRow.appendChild(backButton);

    // Search input field
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search notebooks...';
    applyStyles(searchInput, {
      width: '100%',
      padding: '8px 10px',
      border: `1px solid transparent`,
      borderRadius: '6px',
      backgroundColor: isDark ? '#2f2f2f' : '#fff',
      color: isDark ? '#eee' : '#333',
      fontSize: '14px',
    });

    searchInput.addEventListener('click', e => e.stopPropagation());
    headerRow.appendChild(searchInput);

    viewContainer.appendChild(headerRow);

    // --- 2. Separator ---
    const separator = document.createElement('div');
    applyStyles(separator, {
      height: '1px',
      backgroundColor: isDark ? '#444' : '#cccccc',
      margin: '0 4px 4px 4px',
    });
    viewContainer.appendChild(separator);

    // --- 3. Notebook List Container (for scrolling) ---
    const listContainer = document.createElement('div');
    applyStyles(listContainer, {
      maxHeight: '260px',
      overflowY: 'auto',
      padding: '0 4px',
    });
    viewContainer.appendChild(listContainer);

    // --- 4. Search Functionality ---
    searchInput.addEventListener('input', () => {
      const searchTerm = searchInput.value.toLowerCase();
      const notebookItems = listContainer.querySelectorAll(
        '.nexus-dd-item[data-id]'
      );
      notebookItems.forEach(item => {
        const itemName = item.textContent.toLowerCase();
        item.style.display = itemName.includes(searchTerm) ? 'flex' : 'none';
      });
    });

    // --- 5. Data Fetching and Rendering ---
    const loadingItem = createDropdownItem({
      id: 'nexus-dd-loading',
      icon: '...',
      text: 'Loading...',
      isDark,
    });
    loadingItem.style.justifyContent = 'center';
    listContainer.appendChild(loadingItem);

    try {
      const response = await sendMessageToBackground('GET_NOTEBOOK_LIST');
      loadingItem.remove();
      if (response.success) {
        if (response.notebooks.length === 0) {
          const noNotebooksItem = createDropdownItem({
            icon: '!',
            text: 'No notebooks found.',
            isDark,
          });
          noNotebooksItem.style.cursor = 'default';
          listContainer.appendChild(noNotebooksItem);
        } else {
          response.notebooks.forEach(nb => {
            const item = createDropdownItem({
              id: nb.id,
              icon: nb.emoji,
              text: nb.name,
              isDark,
            });
            item.addEventListener('click', e => {
              e.stopPropagation();
              handleItemClick(nb.id);
            });
            listContainer.appendChild(item);
          });
        }
      } else {
        throw new Error('Failed to load notebooks.');
      }
    } catch (error) {
      console.error('Kortex: Error fetching notebooks.', error);
      loadingItem.textContent = 'Error loading notebooks.';
      loading_item.style.color = '#ff8a8a';
    }
  }
  // MODIFIED: This function now implements a two-step workflow.
  // MODIFIED: This function now uses the new title scraper.
  async function toggleDropdownMenu (conversationData, platform) {
    if (UI_STATE.dropdownMenu) {
      closeDropdown();
      return;
    }

    const isDark = getSystemTheme() === 'dark';
    const menu = document.createElement('div');
    UI_STATE.dropdownMenu = menu;

    // The existing code for styling the menu's contents doesn't need to change.
    // We only modify where the final menu gets attached to the page.
    applyStyles(menu, {
      position: 'absolute',
      top: '110%', // This will now be relative to the button or portal
      right: '0',
      background: isDark ? '#2f2f2f' : '#ffffff',
      color: isDark ? 'white' : '#333333',
      borderRadius: '8px',
      boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
      zIndex: '10001',
      width: '250px',
      fontFamily: 'sans-serif',
      border: isDark ? '1px solid #444' : '1px solid #cccccc',
      maxHeight: '350px',
      overflowY: 'auto',
    });

    const handleItemClick = notebookId => {
      closeDropdown();
      updateButtonUI('loading', notebookId ? 'Saving...' : 'Creating...');
      const conversationTitle = getConversationTitle(platform);
      const prefixedTitle = `[${platform.name.toUpperCase()}] ${conversationTitle}`;
      sendMessageToBackground('SAVE_CONVERSATION', {
        conversation: conversationData,
        notebookId,
        source: prefixedTitle,
      });
    };

    // --- No changes to the logic for populating the menu ---
    const initialView = document.createElement('div');
    initialView.className = 'nexus-initial-view';
    const notebookListView = document.createElement('div');
    notebookListView.className = 'nexus-notebook-list-view';
    notebookListView.style.display = 'none';
    const createNewItem = createDropdownItem({
      icon: '+',
      text: 'Create New Notebook',
      isDark,
    });
    createNewItem.addEventListener('click', e => {
      e.stopPropagation();
      handleItemClick(null);
    });
    initialView.appendChild(createNewItem);
    const useExistingItem = createDropdownItem({
      icon: '...',
      text: 'Use Existing Notebook',
      isDark,
    });
    useExistingItem.addEventListener('click', e => {
      e.stopPropagation();
      initialView.style.display = 'none';
      notebookListView.style.display = 'block';
      populateNotebookListView(notebookListView, isDark, handleItemClick);
    });
    initialView.appendChild(useExistingItem);
    menu.appendChild(initialView);
    menu.appendChild(notebookListView);

    // --- The New, Simpler Logic ---
    // 1. Find the container: Use the portal if it exists, otherwise find the button by its ID.
    const container =
      UI_STATE.portalContainer || document.getElementById('archive-button');

    if (container) {
      // 2. Make the container a positioning anchor for the absolute-positioned menu.
      // This ensures the menu appears relative to the button on Google Docs.
      if (window.getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
      }

      // 3. Append the menu.
      container.appendChild(menu);
    } else {
      console.error(
        'Kortex: Could not find a container for the dropdown menu.'
      );
    }

    setTimeout(() => document.addEventListener('click', closeDropdown), 0);
  }

  // MODIFIED: This function now forces white text color for error messages.
  function updateButtonUI (status, message) {
    if (!UI_STATE.archiveButton) return;

    const button = UI_STATE.archiveButton;
    const contentWrapper = button.querySelector('div.flex');

    button.disabled = status === 'loading';
    button.style.cursor = status === 'loading' ? 'wait' : 'pointer';

    if (status === 'loading' || status === 'success' || status === 'error') {
      if (contentWrapper) {
        // NEW: Check if the status is 'error' to set the text color.
        const textColor = status === 'error' ? 'color: white;' : '';

        // Display the message with consistent styling, now including the text color.
        contentWrapper.innerHTML = `<span style="font-size: 14px; font-weight: 500; white-space: nowrap; ${textColor}">${message}</span>`;
      }
    }

    const colorMap = {
      success: '#28a745',
      error: '#dc3545', // Red background for errors
    };

    if (colorMap[status]) {
      button.style.backgroundColor = colorMap[status];
    }

    if (status === 'success' || status === 'error') {
      setTimeout(() => {
        button.disabled = false;
        if (button.querySelector('div.flex')) {
          button.querySelector('div.flex').parentElement.innerHTML =
            UI_STATE.originalButtonContent;
        }
        button.style.backgroundColor = '';
        button.style.cursor = 'pointer';
      }, 4000);
    }
  }

  function createArchiveButton (platform) {
    if (UI_STATE.archiveButton) return UI_STATE.archiveButton;

    const button = document.createElement('button');
    button.id = 'archive-button';
    button.setAttribute('aria-label', 'Archive to NotebookLM');

    // MODIFIED: SVG paths replaced with a placeholder.
    const initialContent = `
             <div class="flex w-full items-center justify-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 1253 132" style="width: 110px; fill:currentColor;">
                    <g><g id="Layer_1"><g><path d="M1123.69,129.13V.97h26.49l37.41,97.55h1.08L1226.26.97h26.49v128.16h-19.33V56.64l1.07-22.73h-1.07l-37.42,95.23h-15.57l-37.41-95.23h-1.07l1.07,22.73v72.5h-19.33Z"></path><path d="M1034.14,129.13V.97h19.69v109.55h55.13v18.62h-74.82Z"></path><path d="M941.02,129.13V.97h19.33v75.54l38.66-38.66h23.98v1.07l-35.26,34.9,36.51,54.24v1.07h-22.91l-27.21-41.89-13.78,13.6v28.28h-19.33Z"></path><path d="M881.84,132c-9.43,0-17.72-2.15-24.88-6.44-7.16-4.3-12.77-10.08-16.83-17.36-4.06-7.4-6.09-15.63-6.09-24.7s2.03-17.24,6.09-24.52c4.06-7.4,9.67-13.25,16.83-17.54,7.16-4.3,15.45-6.44,24.88-6.44s17.54,2.21,24.7,6.62c7.16,4.3,12.77,10.08,16.83,17.36,4.06,7.28,6.09,15.45,6.09,24.52s-2.03,17.3-6.09,24.7c-4.06,7.28-9.67,13.07-16.83,17.36s-15.39,6.44-24.7,6.44ZM881.84,114.28c5.01,0,9.67-1.19,13.96-3.58,4.3-2.51,7.76-6.03,10.38-10.56,2.74-4.65,4.12-10.2,4.12-16.65s-1.37-11.93-4.12-16.47c-2.63-4.65-6.09-8.17-10.38-10.56-4.3-2.51-8.95-3.76-13.96-3.76s-9.73,1.25-14.14,3.76c-4.3,2.39-7.82,5.91-10.56,10.56-2.63,4.53-3.94,10.02-3.94,16.47s1.31,11.99,3.94,16.65c2.74,4.53,6.32,8.06,10.74,10.56,4.41,2.39,9.07,3.58,13.96,3.58Z"></path><path d="M778.84,132c-9.43,0-17.72-2.15-24.88-6.44-7.16-4.3-12.77-10.08-16.83-17.36-4.06-7.4-6.09-15.63-6.09-24.7s2.03-17.24,6.09-24.52c4.06-7.4,9.67-13.25,16.83-17.54,7.16-4.3,15.45-6.44,24.88-6.44s17.54,2.21,24.7,6.62c7.16,4.3,12.77,10.08,16.83,17.36,4.06,7.28,6.09,15.45,6.09,24.52s-2.03,17.3-6.09,24.7c-4.06,7.28-9.67,13.07-16.83,17.36-7.16,4.3-15.39,6.44-24.7,6.44ZM778.84,114.28c5.01,0,9.67-1.19,13.96-3.58,4.3-2.51,7.76-6.03,10.38-10.56,2.74-4.65,4.12-10.2,4.12-16.65s-1.37-11.93-4.12-16.47c-2.63-4.65-6.09-8.17-10.38-10.56-4.3-2.51-8.95-3.76-13.96-3.76s-9.73,1.25-14.14,3.76c-4.3,2.39-7.82,5.91-10.56,10.56-2.63,4.53-3.94,10.02-3.94,16.47s1.31,11.99,3.94,16.65c2.74,4.53,6.32,8.06,10.74,10.56,4.41,2.39,9.07,3.58,13.96,3.58Z"></path><path d="M679.63,132c-4.65,0-8.89-.72-12.71-2.15-3.82-1.43-7.16-3.28-10.02-5.55-2.74-2.39-4.95-4.83-6.62-7.34h-1.07v12.17h-18.26V.97h19.33v36.52l-1.07,12.71h1.07c1.67-2.63,3.88-5.07,6.62-7.34,2.86-2.39,6.21-4.3,10.02-5.73,3.82-1.43,8.06-2.15,12.71-2.15,8.35,0,15.81,2.09,22.38,6.26,6.56,4.18,11.75,9.9,15.57,17.18,3.94,7.28,5.91,15.63,5.91,25.06s-1.97,17.78-5.91,25.06c-3.82,7.28-9.01,13.01-15.57,17.18-6.56,4.18-14.02,6.26-22.38,6.26ZM676.77,114.28c4.77,0,9.25-1.25,13.42-3.76,4.3-2.51,7.7-6.09,10.2-10.74,2.62-4.65,3.94-10.08,3.94-16.29s-1.31-11.75-3.94-16.29c-2.51-4.65-5.91-8.23-10.2-10.74-4.18-2.51-8.65-3.76-13.42-3.76s-9.25,1.25-13.42,3.76-7.58,6.09-10.2,10.74c-2.63,4.53-3.94,9.96-3.94,16.29s1.31,11.81,3.94,16.47c2.62,4.54,6.03,8.06,10.2,10.56,4.18,2.51,8.65,3.76,13.42,3.76Z"></path><path d="M575.06,132c-8.95,0-16.94-2.09-23.99-6.26-7.04-4.18-12.59-9.9-16.65-17.18-3.94-7.28-5.91-15.57-5.91-24.88,0-8.71,1.91-16.77,5.73-24.17,3.82-7.4,9.13-13.31,15.93-17.72,6.92-4.53,14.86-6.8,23.81-6.8,9.43,0,17.42,2.03,23.99,6.09,6.68,4.06,11.75,9.61,15.21,16.65,3.46,7.04,5.19,14.98,5.19,23.81,0,1.31-.06,2.51-.18,3.58,0,1.07-.06,1.91-.18,2.51h-70.53c.48,5.01,1.73,9.37,3.76,13.07,2.62,4.65,6.09,8.17,10.38,10.56,4.3,2.39,8.95,3.58,13.96,3.58,6.09,0,11.16-1.37,15.21-4.12,4.18-2.86,7.46-6.38,9.85-10.56l15.93,7.7c-3.94,7.16-9.31,13.01-16.11,17.54-6.8,4.42-15.28,6.62-25.42,6.62ZM548.57,73.11h50.66c-.12-2.27-.72-4.65-1.79-7.16-1.07-2.63-2.62-5.01-4.65-7.16s-4.59-3.88-7.7-5.19c-3.1-1.43-6.74-2.15-10.92-2.15-5.25,0-9.91,1.37-13.96,4.12-4.06,2.63-7.22,6.32-9.49,11.1-.95,2.03-1.67,4.18-2.15,6.44Z"></path><path d="M466.03,37.85h15.93V12.07h19.33v25.78h22.38v16.83h-22.38v43.85c0,4.53.9,7.99,2.68,10.38,1.91,2.39,5.07,3.58,9.49,3.58,2.15,0,4.06-.3,5.73-.89,1.67-.72,3.34-1.55,5.01-2.51v18.8c-2.03.83-4.18,1.49-6.44,1.97-2.27.48-4.95.72-8.05.72-8.47,0-15.22-2.45-20.23-7.34-5.01-5.01-7.52-11.87-7.52-20.58v-47.97h-15.93v-16.83Z"></path><path d="M414.87,132c-9.43,0-17.72-2.15-24.88-6.44s-12.77-10.08-16.83-17.36c-4.06-7.4-6.09-15.63-6.09-24.7s2.03-17.24,6.09-24.52c4.06-7.4,9.67-13.25,16.83-17.54,7.16-4.3,15.45-6.44,24.88-6.44s17.54,2.21,24.7,6.62c7.16,4.3,12.77,10.08,16.83,17.36,4.06,7.28,6.09,15.45,6.09,24.52s-2.03,17.3-6.09,24.7c-4.06,7.28-9.67,13.07-16.83,17.36s-15.39,6.44-24.7,6.44ZM414.87,114.28c5.01,0,9.67-1.19,13.96-3.58,4.3-2.51,7.76-6.03,10.38-10.56,2.74-4.65,4.12-10.2,4.12-16.65s-1.37-11.93-4.12-16.47c-2.62-4.65-6.09-8.17-10.38-10.56-4.3-2.51-8.95-3.76-13.96-3.76s-9.73,1.25-14.14,3.76c-4.3,2.39-7.82,5.91-10.56,10.56-2.62,4.53-3.94,10.02-3.94,16.47s1.31,11.99,3.94,16.65c2.74,4.53,6.32,8.06,10.74,10.56,4.42,2.39,9.07,3.58,13.96,3.58Z"></path><path d="M252.55,129.13V.97h23.27l58,94.15h1.07l-1.07-24.7V.97h19.51v128.16h-20.41l-60.86-98.99h-1.07l1.07,24.7v74.29h-19.51Z"></path><path d="M87.27,1.14C39.07,1.14,0,39.88,0,87.69v41.44h16.09v-4.13c0-19.39,15.84-35.11,35.39-35.11s35.39,15.72,35.39,35.11v4.13h16.09v-4.13c0-28.2-23.05-51.05-51.48-51.05-11.07,0-21.32,3.46-29.72,9.37,8.79-17.32,26.88-29.21,47.77-29.21,29.51,0,53.44,23.74,53.44,53v22.02h16.09v-22.02c0-38.08-31.13-68.96-69.53-68.96-17.27,0-33.06,6.24-45.22,16.58,11.94-22.39,35.65-37.64,62.97-37.64,39.32,0,71.19,31.61,71.19,70.6v41.44h16.09v-41.44C174.55,39.88,135.48,1.14,87.27,1.14Z"></path></g></g></g>
                </svg>
            </div>
        `;
    const wrapperDiv = document.createElement('div');
    wrapperDiv.innerHTML = initialContent;
    button.appendChild(wrapperDiv);

    UI_STATE.originalButtonContent = initialContent;

    // MODIFIED: Click listener now uses shake and updateButtonUI for client-side errors.
    button.addEventListener('click', e => {
      e.stopPropagation();
      const conversationData = platform.scrapeConversation();
      if (conversationData && conversationData.length > 0) {
        toggleDropdownMenu(conversationData, platform);
      } else {
        // Shake the button and update its UI to show the error message.
        shakeElement(button);
        updateButtonUI('error', 'No text found!');
      }
    });

    UI_STATE.archiveButton = button;
    return button;
  }

  function createPortalContainer () {
    if (UI_STATE.portalContainer) return UI_STATE.portalContainer;

    const portal = document.createElement('div');
    portal.id = 'nexus-archive-portal-container';
    applyStyles(portal, {
      position: 'absolute',
      zIndex: '9999',
    });
    document.body.appendChild(portal);
    UI_STATE.portalContainer = portal;
    return portal;
  }

  // ======================================================================
  // 5. INITIALIZATION
  // ======================================================================

  function initialize () {
    console.log('Kortex: Content script initializing...');
    addAnimationStyles();


    // This uses .filter() to find ALL matching platforms on the current page.
    const currentPlatforms = platforms.filter(p =>
      p.hostnames.some(h => window.location.hostname.includes(h))
    );

    if (currentPlatforms.length > 0) {
      // Loop through all detected platforms (e.g., NotebookLM and NotebookLM-Dashboard)
      currentPlatforms.forEach(platform => {
        console.log(`Kortex: ${platform.name} platform detected.`);
        platform.injectUI();
      });

      // The message listener only needs to be set up once.
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'UPDATE_STATUS') {
          console.log('Kortex: Status update received:', request);
          updateButtonUI(request.status, request.message);
        }
        // Ensure you handle other message types if they can be sent from non-platform pages
        // For now, we assume UPDATE_STATUS is the main one from generic contexts.
        sendResponse({ success: true });
        return true;
      });
    } else {
      console.log('Kortex: No supported platform detected on this page.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
