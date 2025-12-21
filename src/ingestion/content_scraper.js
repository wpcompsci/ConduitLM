// ConduitLM Content Scraper
// Ported from Kortex, adapted for Firefox MV3

(function () {
    'use strict';

    const UI_STATE = {
        archiveButton: null,
        portalContainer: null
    };

    // ======================================================================
    // UI HELPERS
    // ======================================================================

    function createPortalContainer() {
        if (UI_STATE.portalContainer) return UI_STATE.portalContainer;
        const div = document.createElement('div');
        div.id = 'conduit-portal';
        div.style.position = 'absolute';
        div.style.zIndex = '9999';
        div.style.display = 'none';
        document.body.appendChild(div);
        UI_STATE.portalContainer = div;
        return div;
    }

    function createArchiveButton(platform) {
        if (UI_STATE.archiveButton) return UI_STATE.archiveButton;

        const button = document.createElement('button');
        button.innerText = 'Save to NotebookLM';
        button.style.backgroundColor = '#1a73e8'; // Google Blue
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.padding = '8px 12px';
        button.style.borderRadius = '4px';
        button.style.cursor = 'pointer';
        button.style.fontWeight = '500';
        button.style.fontSize = '14px';
        button.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.gap = '6px';

        // Add Icon
        const icon = document.createElement('span');
        icon.innerText = '📥';
        button.prepend(icon);

        button.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const buttonOriginalText = button.innerText;
            button.innerText = 'Saving...';
            button.disabled = true;

            try {
                const conversation = platform.scrapeConversation();
                if (!conversation || conversation.length === 0) {
                    throw new Error("No conversation content found to save.");
                }

                let title = document.title;
                if (platform.selectors.CONVERSATION_TITLE) {
                    const titleEl = document.querySelector(platform.selectors.CONVERSATION_TITLE);
                    if (titleEl) title = titleEl.innerText.trim() || title;
                }
                // Fallback for title
                if (title === "New chat" || !title) {
                    title = `Chat ${new Date().toLocaleString()}`;
                }

                // Send to Background
                // Using platform.name like in Kortex to help standard title formatting
                const sourceTitle = `[${platform.name}] ${title}`;

                const response = await browser.runtime.sendMessage({
                    type: 'SAVE_CONVERSATION',
                    data: {
                        conversation,
                        source: sourceTitle
                    }
                });

                if (response && response.success) {
                    button.innerText = 'Saved!';
                    setTimeout(() => {
                        button.innerText = buttonOriginalText;
                        button.disabled = false;
                    }, 2000);
                } else {
                    throw new Error(response ? response.message : "Unknown error");
                }

            } catch (err) {
                console.error("ConduitLM Error:", err);
                button.innerText = 'Error';
                alert(`Failed to save: ${err.message}`);
                setTimeout(() => {
                    button.innerText = buttonOriginalText;
                    button.disabled = false;
                }, 2000);
            }
        });

        UI_STATE.archiveButton = button;
        return button;
    }

    // ======================================================================
    // PLATFORM CONFIGS
    // ======================================================================

    const platforms = [
        {
            name: 'ChatGPT',
            hostnames: ['chat.openai.com', 'chatgpt.com'],
            selectors: {
                UI_TARGET_ELEMENT: '#conversation-header-actions', // This changes often
                TURN_CONTAINER: 'article[data-turn-id]',
                MESSAGE_ROLE: '[data-message-author-role]',
                MESSAGE_CONTENT: '.whitespace-pre-wrap, .markdown',
            },
            scrapeConversation: function () {
                const messages = [];
                const turnElements = document.querySelectorAll(this.selectors.TURN_CONTAINER);
                turnElements.forEach(turn => {
                    const roleElement = turn.querySelector(this.selectors.MESSAGE_ROLE);
                    const contentElement = turn.querySelector(this.selectors.MESSAGE_CONTENT);
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
                // ChatGPT structure is dynamic, we need to find the header actions
                const findTarget = () => {
                    // Try multiple selectors as ChatGPT changes classes
                    return document.querySelector('div.flex.items-center.gap-2.pr-1') ||
                        document.querySelector('#conversation-header-actions');
                };

                const updateButtonPosition = () => {
                    const targetElement = findTarget();
                    // If not found, look for alternative "Share" button area

                    const portal = createPortalContainer();
                    const button = createArchiveButton(this);

                    if (targetElement) {
                        button.className = ''; // Reset class
                        // Style to match ChatGPT somewhat? Or just keep our custom style
                        // For now keep custom style to be visible

                        if (!portal.contains(button)) {
                            portal.appendChild(button);
                        }

                        const rect = targetElement.getBoundingClientRect();
                        // Position safely
                        portal.style.top = `${rect.top + window.scrollY + 5}px`;
                        portal.style.left = `${rect.left + window.scrollX - 160}px`; // Shift left of the buttons
                        portal.style.display = 'block';
                    } else {
                        portal.style.display = 'none';
                    }
                };

                // Observer
                const observer = new MutationObserver(updateButtonPosition);
                observer.observe(document.body, { childList: true, subtree: true });
                setInterval(updateButtonPosition, 1000); // Fallback poll
            }
        },
        {
            name: 'Gemini',
            hostnames: ['gemini.google.com'],
            selectors: {
                // Target the header area properly
                UI_TARGET_ELEMENT: 'div.right-section, mat-toolbar',
                CONVERSATION_CONTAINER: 'div.conversation-container',
                USER_QUERY_BLOCK: 'user-query',
                MODEL_RESPONSE_BLOCK: 'model-response',
                USER_CONTENT: 'div.query-text',
                MODEL_CONTENT: 'div.markdown',
                CONVERSATION_TITLE: '.conversation-title, .title'
            },
            scrapeConversation: function () {
                const messages = [];
                // Simple version of scraping
                const turnElements = document.querySelectorAll(`${this.selectors.CONVERSATION_CONTAINER} > ${this.selectors.USER_QUERY_BLOCK}, ${this.selectors.CONVERSATION_CONTAINER} > ${this.selectors.MODEL_RESPONSE_BLOCK}`);

                turnElements.forEach(turn => {
                    let role = '';
                    let content = '';
                    if (turn.tagName.toLowerCase() === 'user-query') {
                        role = 'user';
                        const el = turn.querySelector(this.selectors.USER_CONTENT);
                        if (el) content = el.innerText.trim();
                    } else if (turn.tagName.toLowerCase() === 'model-response') {
                        role = 'model';
                        const el = turn.querySelector(this.selectors.MODEL_CONTENT);
                        if (el) content = el.innerText.trim();
                    }
                    if (role && content) messages.push({ role, content });
                });
                return messages;
            },
            injectUI: function () {
                const updateButtonPosition = () => {
                    // Gemini header usually has a 'share' button or similar
                    const targetElement = document.querySelector('div.right-section') || document.querySelector('mat-toolbar');

                    const portal = createPortalContainer();
                    const button = createArchiveButton(this);

                    if (targetElement) {
                        if (!portal.contains(button)) {
                            portal.appendChild(button);
                        }
                        const rect = targetElement.getBoundingClientRect();
                        // Position at top right
                        portal.style.top = '10px';
                        portal.style.right = '150px'; // Offset from profile/other icons
                        portal.style.left = 'auto';
                        portal.style.display = 'block';
                    }
                };
                const observer = new MutationObserver(updateButtonPosition);
                observer.observe(document.body, { childList: true, subtree: true });
                updateButtonPosition();
            }
        },
        {
            name: 'Google Docs',
            hostnames: ['docs.google.com'],
            selectors: {
                UI_TARGET_ELEMENT: '#docs-titlebar-share-client-button',
                CONVERSATION_TITLE: 'input.docs-title-input'
            },
            scrapeConversation: function () {
                const docIdMatch = window.location.href.match(/document\/d\/([a-zA-Z0-9_-]+)/);
                if (!docIdMatch || !docIdMatch[1]) return [];
                return [{ role: 'document', content: docIdMatch[1] }];
            },
            injectUI: function () {
                const updateButton = () => {
                    const targetElement = document.querySelector(this.selectors.UI_TARGET_ELEMENT);

                    // We can actually inject directly into DOM for Docs usually, but let's stick to portal if possible? 
                    // No, Docs has complex layout. Kortex injected BEFORE target.
                    if (targetElement && !document.getElementById('conduit-docs-btn')) {
                        const button = createArchiveButton(this);
                        button.id = 'conduit-docs-btn';
                        // Style adaptation
                        button.className = 'goog-inline-block jfk-button jfk-button-standard'; // Native look
                        button.innerText = 'Save to NotebookLM';
                        button.style.marginRight = '8px';

                        targetElement.parentElement.insertBefore(button, targetElement);
                    }
                };
                const observer = new MutationObserver(updateButton);
                observer.observe(document.body, { childList: true, subtree: true });
                setTimeout(updateButton, 2000);
            }
        }
    ];

    // Initialize
    const currentHost = window.location.hostname;
    const platform = platforms.find(p => p.hostnames.some(h => currentHost.includes(h)));

    if (platform) {
        console.log(`ConduitLM: Detected platform ${platform.name}`);
        platform.injectUI();
    }

})();
