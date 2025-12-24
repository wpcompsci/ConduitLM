// In-Page Floating Trigger UI
(function (scope) {
  const ROOT_ID = 'conduitlm-inpage-root';
  const YOUTUBE_BUTTON_HOST_ID = 'conduitlm-youtube-button-host';
  const TOAST_DURATION_MS = 3500;
  const CREATE_OPTION_VALUE = '__create__';

  let panelApi = null;
  let youtubeObserver = null;

  function requestPanelToggle() {
    if (panelApi && typeof panelApi.toggle === 'function') {
      panelApi.toggle();
      return;
    }
    const root = document.getElementById(ROOT_ID);
    if (!root || !root.shadowRoot) return;
    const fab = root.shadowRoot.querySelector('.conduitlm-fab');
    if (fab) {
      fab.click();
    }
  }

  function isYouTubeWatchPage() {
    if (location.hostname !== 'www.youtube.com') return false;
    return (
      location.pathname.startsWith('/watch') ||
      location.pathname.startsWith('/shorts/') ||
      location.pathname.startsWith('/live/')
    );
  }

  function findYouTubeActionBar() {
    const selectors = [
      'ytd-watch-metadata #top-level-buttons-computed',
      '#top-level-buttons-computed',
      'ytd-watch-metadata #top-level-buttons',
      '#top-level-buttons',
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function buildYouTubeButton() {
    const host = document.createElement('span');
    host.id = YOUTUBE_BUTTON_HOST_ID;
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: inline-flex;
        align-items: center;
        margin-left: 8px;
      }
      .conduitlm-yt-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 36px;
        padding: 0 14px;
        border-radius: 18px;
        border: 1px solid #d9d9d9;
        background: #111111;
        color: #ffffff;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.3px;
        cursor: pointer;
      }
      .conduitlm-yt-btn:hover {
        background: #1b1b1b;
      }
      .conduitlm-yt-btn:active {
        background: #000000;
      }
    `;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'conduitlm-yt-btn';
    button.textContent = 'ConduitLM';
    button.setAttribute('aria-label', 'ConduitLM quick send');
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      requestPanelToggle();
    });

    shadow.append(style, button);
    return host;
  }

  function installYouTubeButton() {
    if (!isYouTubeWatchPage()) return false;
    if (document.getElementById(YOUTUBE_BUTTON_HOST_ID)) return true;
    const container = findYouTubeActionBar();
    if (!container) return false;
    const host = buildYouTubeButton();
    container.prepend(host);
    return true;
  }

  function ensureYouTubeButton() {
    if (!isYouTubeWatchPage()) return;
    installYouTubeButton();
    if (youtubeObserver) return;
    youtubeObserver = new MutationObserver(() => {
      if (!isYouTubeWatchPage()) return;
      installYouTubeButton();
    });
    youtubeObserver.observe(document.body, { childList: true, subtree: true });
  }

  function init(options) {
    const opts = options || {};
    if (opts.youtubeButton) {
      ensureYouTubeButton();
    }

    if (document.getElementById(ROOT_ID)) return;

    const sourceOnly =
      scope.ConduitHosts &&
      typeof scope.ConduitHosts.isSourceExtractHost === 'function'
        ? scope.ConduitHosts.isSourceExtractHost(location.href)
        : true;

    const host = document.createElement('div');
    host.id = ROOT_ID;
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147483647;
        font-family: "Segoe UI", "Trebuchet MS", "Verdana", sans-serif;
      }
      * {
        box-sizing: border-box;
      }
      .conduitlm-shell {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
      }
      .conduitlm-toast {
        display: none;
        max-width: 240px;
        padding: 8px 10px;
        border-radius: 10px;
        font-size: 12px;
        line-height: 1.3;
        color: #fff;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
      }
      .conduitlm-toast.success {
        background: #1e8e3e;
      }
      .conduitlm-toast.error {
        background: #d93025;
      }
      .conduitlm-panel {
        display: none;
        width: 260px;
        padding: 10px;
        border-radius: 12px;
        background: #ffffff;
        border: 1px solid #e0e0e0;
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.18);
        gap: 8px;
      }
      .conduitlm-panel.open {
        display: flex;
        flex-direction: column;
      }
      .conduitlm-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #5f6368;
        font-weight: 600;
      }
      .conduitlm-intents {
        display: grid;
        grid-template-columns: 1fr;
        gap: 6px;
      }
      .conduitlm-option {
        width: 100%;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid #dadce0;
        background: #f8f9fa;
        color: #202124;
        font-size: 13px;
        text-align: left;
        cursor: pointer;
      }
      .conduitlm-option.active {
        background: #1a73e8;
        border-color: #1a73e8;
        color: #ffffff;
      }
      .conduitlm-option:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .conduitlm-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .conduitlm-select,
      .conduitlm-input {
        width: 100%;
        padding: 8px;
        border: 1px solid #dadce0;
        border-radius: 6px;
        font-size: 12px;
      }
      .conduitlm-inline-note {
        font-size: 11px;
        color: #d93025;
      }
      .conduitlm-actions {
        display: flex;
        justify-content: flex-end;
        gap: 6px;
      }
      .conduitlm-confirm {
        background: #1a73e8;
        border: none;
        color: #ffffff;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 13px;
        cursor: pointer;
      }
      .conduitlm-confirm:disabled {
        opacity: 0.6;
        cursor: default;
      }
      .conduitlm-fab {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 1px solid #1f1f1f;
        background: #111111;
        color: #ffffff;
        font-weight: 700;
        font-size: 14px;
        letter-spacing: 0.5px;
        cursor: pointer;
        box-shadow: 0 10px 22px rgba(0, 0, 0, 0.25);
      }
    `;

    const shell = document.createElement('div');
    shell.className = 'conduitlm-shell';

    const toast = document.createElement('div');
    toast.className = 'conduitlm-toast';

    const panel = document.createElement('div');
    panel.className = 'conduitlm-panel';

    const intentLabel = document.createElement('div');
    intentLabel.className = 'conduitlm-label';
    intentLabel.textContent = 'Intent';

    const intentGroup = document.createElement('div');
    intentGroup.className = 'conduitlm-intents';

    const selectionBtn = document.createElement('button');
    selectionBtn.type = 'button';
    selectionBtn.className = 'conduitlm-option';
    selectionBtn.textContent = 'Send Selection';

    const sourceBtn = document.createElement('button');
    sourceBtn.type = 'button';
    sourceBtn.className = 'conduitlm-option';
    sourceBtn.textContent = 'Send Source Extract';

    const pageBtn = document.createElement('button');
    pageBtn.type = 'button';
    pageBtn.className = 'conduitlm-option';
    pageBtn.textContent = 'Send Page Main Content';

    intentGroup.append(selectionBtn, sourceBtn, pageBtn);

    if (sourceOnly) {
      selectionBtn.style.display = 'none';
      pageBtn.style.display = 'none';
    }

    const destinationField = document.createElement('div');
    destinationField.className = 'conduitlm-field';

    const destinationLabel = document.createElement('div');
    destinationLabel.className = 'conduitlm-label';
    destinationLabel.textContent = 'Destination';

    const notebookSelect = document.createElement('select');
    notebookSelect.className = 'conduitlm-select';

    const createInput = document.createElement('input');
    createInput.className = 'conduitlm-input';
    createInput.placeholder = 'New notebook name';
    createInput.style.display = 'none';

    const notebookError = document.createElement('div');
    notebookError.className = 'conduitlm-inline-note';
    notebookError.style.display = 'none';

    destinationField.append(destinationLabel, notebookSelect, createInput, notebookError);

    const actionsRow = document.createElement('div');
    actionsRow.className = 'conduitlm-actions';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'conduitlm-confirm';
    confirmBtn.textContent = 'Confirm Send';
    confirmBtn.disabled = true;

    actionsRow.append(confirmBtn);

    panel.append(intentLabel, intentGroup, destinationField, actionsRow);

    const fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'conduitlm-fab';
    fab.textContent = 'CL';
    fab.setAttribute('aria-label', 'ConduitLM quick send');

    shell.append(toast, panel, fab);
    shadow.append(style, shell);
    document.documentElement.appendChild(host);

    const state = {
      selectedIntent: sourceOnly ? scope.ConduitTriggers.INTENTS.sourceExtract : null,
      notebooks: null,
      loading: false,
    };

    let toastTimer = null;

    function getSelectionText() {
      const selection = window.getSelection ? window.getSelection().toString() : '';
      return selection ? selection.trim() : '';
    }

    function updateSelectionAvailability() {
      if (sourceOnly) {
        selectionBtn.style.display = 'none';
        return;
      }
      const hasSelection = Boolean(getSelectionText());
      selectionBtn.style.display = hasSelection ? 'block' : 'none';
      if (!hasSelection && state.selectedIntent === scope.ConduitTriggers.INTENTS.selection) {
        state.selectedIntent = null;
        updateIntentButtons();
      }
    }

    function showToast(message, variant) {
      if (toastTimer) {
        clearTimeout(toastTimer);
        toastTimer = null;
      }
      toast.textContent = message;
      toast.className = `conduitlm-toast ${variant}`;
      toast.style.display = 'block';
      toastTimer = setTimeout(() => {
        toast.style.display = 'none';
      }, TOAST_DURATION_MS);
    }

    function openPanel() {
      updateSelectionAvailability();
      panel.classList.add('open');
      ensureNotebooksLoaded();
      updateConfirmState();
    }

    function closePanel() {
      panel.classList.remove('open');
    }

    function togglePanel() {
      if (panel.classList.contains('open')) {
        closePanel();
      } else {
        openPanel();
      }
    }

    panelApi = { open: openPanel, close: closePanel, toggle: togglePanel };

    function updateIntentButtons() {
      const selected = state.selectedIntent;
      selectionBtn.classList.toggle(
        'active',
        selected === scope.ConduitTriggers.INTENTS.selection
      );
      sourceBtn.classList.toggle(
        'active',
        selected === scope.ConduitTriggers.INTENTS.sourceExtract
      );
      pageBtn.classList.toggle(
        'active',
        selected === scope.ConduitTriggers.INTENTS.pageMain
      );
      updateConfirmState();
    }

    function setIntent(intent) {
      state.selectedIntent = intent;
      updateIntentButtons();
    }

    function setNotebookError(message) {
      if (message) {
        notebookError.textContent = message;
        notebookError.style.display = 'block';
      } else {
        notebookError.textContent = '';
        notebookError.style.display = 'none';
      }
    }

    function updateConfirmState() {
      const hasIntent = Boolean(state.selectedIntent);
      const selection = notebookSelect.value;
      const isCreate = selection === CREATE_OPTION_VALUE;
      const hasTitle = createInput.value.trim().length > 0;
      const destinationReady = selection && (!isCreate || hasTitle);
      confirmBtn.disabled = !hasIntent || !destinationReady || state.loading;
    }

    function populateNotebooks(notebooks) {
      notebookSelect.innerHTML = '';
      const defaultOpt = document.createElement('option');
      defaultOpt.textContent = 'Select a notebook...';
      defaultOpt.value = '';
      defaultOpt.disabled = true;
      defaultOpt.selected = true;
      notebookSelect.appendChild(defaultOpt);

      notebooks.forEach((nb) => {
        const opt = document.createElement('option');
        opt.value = nb.id;
        opt.textContent = nb.title;
        opt.dataset.title = nb.title;
        notebookSelect.appendChild(opt);
      });

      const createOpt = document.createElement('option');
      createOpt.value = CREATE_OPTION_VALUE;
      createOpt.textContent = 'Create new notebook...';
      notebookSelect.appendChild(createOpt);
    }

    async function ensureNotebooksLoaded() {
      if (state.loading || state.notebooks) return;
      state.loading = true;
      setNotebookError('');
      notebookSelect.innerHTML = '<option>Loading notebooks...</option>';
      confirmBtn.disabled = true;

      try {
        const response = await browser.runtime.sendMessage({ type: 'NLM_LIST_NOTEBOOKS' });
        if (!response || !response.ok) {
          throw response ? response.error : { code: 'unknown', message: 'No response' };
        }
        state.notebooks = response.data || [];
        populateNotebooks(state.notebooks);
      } catch (error) {
        const code = error && error.code ? error.code : 'unknown';
        const message = error && error.message ? error.message : 'Failed to load notebooks';
        setNotebookError(`[${code}] ${message}`);
        notebookSelect.innerHTML = '<option>Notebook access required</option>';
      } finally {
        state.loading = false;
        updateConfirmState();
      }
    }

    function buildDestination() {
      const selection = notebookSelect.value;
      const isCreate = selection === CREATE_OPTION_VALUE;
      if (!selection) return null;
      if (isCreate) {
        return { type: 'create', title: createInput.value.trim() };
      }
      const selectedOption = notebookSelect.selectedOptions[0];
      return {
        type: 'select',
        id: selection,
        title: selectedOption ? selectedOption.dataset.title : '',
      };
    }

    async function sendTrigger() {
      const destination = buildDestination();
      if (!state.selectedIntent || !destination) {
        updateConfirmState();
        return;
      }

      const trigger = {
        triggerType: scope.ConduitTriggers.TRIGGER_TYPES.inPage,
        intent: state.selectedIntent,
        url: location.href,
        requestId: scope.ConduitTriggers.createRequestId(),
      };

      showToast('Sending to NotebookLM...', 'success');

      try {
        const response = await browser.runtime.sendMessage({
          type: 'TRIGGER_SEND_FLOW',
          trigger,
          destination,
        });
        if (!response || !response.ok) {
          throw response ? response.error : { code: 'unknown', message: 'No response' };
        }
        showToast('Sent to NotebookLM.', 'success');
        closePanel();
      } catch (error) {
        const code = error && error.code ? error.code : 'unknown';
        const message = error && error.message ? error.message : 'Send failed';
        showToast(`[${code}] ${message}`, 'error');
      }
    }

    fab.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      togglePanel();
    });

    updateIntentButtons();

    selectionBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setIntent(scope.ConduitTriggers.INTENTS.selection);
    });

    sourceBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setIntent(scope.ConduitTriggers.INTENTS.sourceExtract);
    });

    pageBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setIntent(scope.ConduitTriggers.INTENTS.pageMain);
    });

    notebookSelect.addEventListener('change', () => {
      const isCreate = notebookSelect.value === CREATE_OPTION_VALUE;
      createInput.style.display = isCreate ? 'block' : 'none';
      updateConfirmState();
    });

    createInput.addEventListener('input', () => {
      updateConfirmState();
    });

    confirmBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      sendTrigger();
    });

    document.addEventListener('click', (event) => {
      const path = event.composedPath ? event.composedPath() : [];
      if (!path.includes(host)) {
        closePanel();
      }
    });

    document.addEventListener('selectionchange', () => {
      updateSelectionAvailability();
    });

    window.addEventListener('blur', () => {
      closePanel();
    });

    if (opts.youtubeButton) {
      ensureYouTubeButton();
    }
  }

  scope.ConduitInPage = { init };
  init();
})(globalThis);
