// Popup Logic
/* global ConduitHosts, ConduitTriggers, ConduitTriggerStore */

document.addEventListener('DOMContentLoaded', init);

const elements = {
  gateView: document.getElementById('gate-view'),
  siteGateView: document.getElementById('site-gate-view'),
  formView: document.getElementById('form-view'),
  statusView: document.getElementById('status-view'),
  btnEnable: document.getElementById('btn-enable-access'),
  btnEnableSite: document.getElementById('btn-enable-site'),
  btnCancelSend: document.getElementById('btn-cancel-send'),
  btnSend: document.getElementById('btn-confirm-send'),
  btnReset: document.getElementById('btn-reset'),
  intentSelectionBtn: document.getElementById('intent-selection'),
  intentSourceBtn: document.getElementById('intent-source'),
  intentPageBtn: document.getElementById('intent-page'),
  notebookSelect: document.getElementById('notebook-select'),
  newTitleInput: document.getElementById('new-notebook-title'),
  statusMessage: document.getElementById('status-message'),
  statusDetail: document.getElementById('status-detail'),
  statusDetailBox: document.getElementById('status-detail-box'),
  statusDetailText: document.getElementById('status-detail-text'),
  statusIcon: document.getElementById('status-icon'),
  siteDomain: document.getElementById('site-domain'),
};

const state = {
  context: null,
  siteOrigin: null,
  pendingRequestId: null,
  permissionsReady: false,
  selectedIntent: null,
  intentPolicy: null,
  hasSelection: false,
};

async function init() {
  elements.btnEnable.onclick = requestNotebookPermission;
  elements.btnEnableSite.onclick = requestSitePermission;
  elements.btnCancelSend.onclick = cancelSend;
  elements.btnSend.onclick = handleSend;
  elements.btnReset.onclick = resetUI;
  elements.notebookSelect.onchange = handleSelectionChange;
  elements.intentSelectionBtn.onclick = () => setIntent(ConduitTriggers.INTENTS.selection);
  elements.intentSourceBtn.onclick = () => setIntent(ConduitTriggers.INTENTS.sourceExtract);
  elements.intentPageBtn.onclick = () => setIntent(ConduitTriggers.INTENTS.pageMain);
  elements.newTitleInput.oninput = updateSendEnabled;

  await checkState();
}

async function checkState() {
  const notice = await ConduitTriggerStore.consumeNotice();
  if (notice) {
    showError(notice.code, notice.message, notice.detail);
    return;
  }

  const hasNotebookPermission = await browser.permissions.contains({
    origins: [ConduitHosts.NOTEBOOKLM_ORIGIN],
  });

  if (!hasNotebookPermission) {
    state.permissionsReady = false;
    showView('gate');
    return;
  }

  const context = await resolveContext();
  if (!context) {
    state.permissionsReady = false;
    return;
  }

  state.siteOrigin = ConduitHosts.getOptionalOrigin(context.url);
  if (state.siteOrigin) {
    const hasSitePermission = await browser.permissions.contains({
      origins: [state.siteOrigin],
    });
    if (!hasSitePermission) {
      state.permissionsReady = false;
      showSiteGate(context.url);
      return;
    }
    await injectInPageUi(context.tabId);
  }

  state.permissionsReady = true;
  applyIntentPolicy();
  await refreshSelectionAvailability();
  showView('form');
  loadNotebooks();
}

async function resolveContext() {
  await ConduitTriggerStore.sweepStale();
  const pending = await ConduitTriggerStore.getLatestPending();
  if (pending) {
    state.pendingRequestId = pending.requestId;
    try {
      const tab = await browser.tabs.get(pending.tabId);
      if (!tab || isRestrictedUrl(tab.url)) {
        throw { code: 'tab_missing', message: 'Original tab is not available' };
      }
      state.context = {
        triggerType: pending.triggerType,
        tabId: pending.tabId,
        url: pending.url,
        requestId: pending.requestId,
      };
      if (pending.intent) {
        state.selectedIntent = pending.intent;
      }
      return state.context;
    } catch (error) {
      await ConduitTriggerStore.removePending(pending.requestId);
      handleError(error);
      return null;
    }
  }

  const tab = await getActiveTab();
  if (!tab) {
    showError('tab_missing', 'No active tab available');
    return null;
  }
  state.context = {
    triggerType: ConduitTriggers.TRIGGER_TYPES.toolbar,
    tabId: tab.id,
    url: tab.url,
    requestId: null,
  };
  state.selectedIntent = null;
  state.pendingRequestId = null;
  return state.context;
}

async function getActiveTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tabs || tabs.length === 0) {
    return null;
  }
  const tab = tabs[0];
  if (!tab || isRestrictedUrl(tab.url)) {
    return null;
  }
  return tab;
}

function isRestrictedUrl(url) {
  return !url || url.startsWith('about:') || url.startsWith('moz-extension:');
}

function showSiteGate(url) {
  let hostname = 'unknown';
  try {
    hostname = new URL(url).hostname;
  } catch (e) {
    hostname = url || 'unknown';
  }
  elements.siteDomain.textContent = hostname;
  showView('siteGate');
}

async function requestNotebookPermission() {
  const granted = await browser.permissions.request({
    origins: [ConduitHosts.NOTEBOOKLM_ORIGIN],
  });

  if (granted) {
    checkState();
  } else {
    showError('permission', 'Permission denied by user');
  }
}

async function requestSitePermission() {
  if (!state.siteOrigin) {
    showError('permission', 'No site permission available for this page');
    return;
  }

  const granted = await browser.permissions.request({
    origins: [state.siteOrigin],
  });

  if (granted) {
    await injectInPageUi(state.context ? state.context.tabId : null);
    checkState();
  } else {
    showError('permission', 'Permission denied by user');
  }
}

async function cancelSend() {
  if (state.pendingRequestId) {
    await ConduitTriggerStore.removePending(state.pendingRequestId);
    state.pendingRequestId = null;
  }
  showStatus('Send cancelled', 'No content was sent.');
  elements.btnReset.classList.remove('hidden');
}

function getIntentPolicy(url) {
  const sourceOnly =
    ConduitHosts &&
    typeof ConduitHosts.isSourceExtractHost === 'function' &&
    ConduitHosts.isSourceExtractHost(url);
  if (sourceOnly) {
    return {
      allowed: [ConduitTriggers.INTENTS.sourceExtract],
      defaultIntent: ConduitTriggers.INTENTS.sourceExtract,
    };
  }
  return {
    allowed: [ConduitTriggers.INTENTS.selection, ConduitTriggers.INTENTS.pageMain],
    defaultIntent: ConduitTriggers.INTENTS.pageMain,
  };
}

function updateIntentButtons() {
  const selected = state.selectedIntent;
  elements.intentSelectionBtn.classList.toggle(
    'active',
    selected === ConduitTriggers.INTENTS.selection
  );
  elements.intentSourceBtn.classList.toggle(
    'active',
    selected === ConduitTriggers.INTENTS.sourceExtract
  );
  elements.intentPageBtn.classList.toggle(
    'active',
    selected === ConduitTriggers.INTENTS.pageMain
  );
  updateSendEnabled();
}

function applyIntentPolicy() {
  const policy = getIntentPolicy(state.context ? state.context.url : null);
  state.intentPolicy = policy;

  const allowSelection = policy.allowed.includes(ConduitTriggers.INTENTS.selection);
  const allowSource = policy.allowed.includes(ConduitTriggers.INTENTS.sourceExtract);
  const allowPage = policy.allowed.includes(ConduitTriggers.INTENTS.pageMain);

  elements.intentSelectionBtn.style.display = allowSelection ? 'block' : 'none';
  elements.intentSourceBtn.style.display = allowSource ? 'block' : 'none';
  elements.intentPageBtn.style.display = allowPage ? 'block' : 'none';

  if (!state.selectedIntent || !policy.allowed.includes(state.selectedIntent)) {
    state.selectedIntent = policy.defaultIntent;
  }

  updateIntentButtons();
}

function setIntent(intent) {
  if (!state.intentPolicy || !state.intentPolicy.allowed.includes(intent)) {
    return;
  }
  if (intent === ConduitTriggers.INTENTS.selection && !state.hasSelection) {
    return;
  }
  state.selectedIntent = intent;
  updateIntentButtons();
}

async function fetchSelectionText(tabId) {
  if (!tabId || typeof tabId !== 'number') return '';
  try {
    const results = await browser.scripting.executeScript({
      target: { tabId },
      func: () => (window.getSelection ? window.getSelection().toString() : ''),
    });
    const lastError = browser.runtime.lastError;
    if (lastError) {
      throw new Error(lastError.message || 'Selection lookup failed');
    }
    if (!results || results.length === 0) return '';
    return results[0].result || '';
  } catch (error) {
    return '';
  }
}

async function refreshSelectionAvailability() {
  if (!state.intentPolicy) return;
  const allowSelection = state.intentPolicy.allowed.includes(
    ConduitTriggers.INTENTS.selection
  );
  if (!allowSelection) {
    state.hasSelection = false;
    elements.intentSelectionBtn.style.display = 'none';
    return;
  }

  const selectionText = await fetchSelectionText(state.context ? state.context.tabId : null);
  const hasSelection = Boolean(selectionText && selectionText.trim());
  state.hasSelection = hasSelection;
  elements.intentSelectionBtn.style.display = hasSelection ? 'block' : 'none';

  if (!hasSelection && state.selectedIntent === ConduitTriggers.INTENTS.selection) {
    state.selectedIntent = state.intentPolicy.defaultIntent;
  }
  if (hasSelection && state.selectedIntent === state.intentPolicy.defaultIntent) {
    state.selectedIntent = ConduitTriggers.INTENTS.selection;
  }

  updateIntentButtons();
}

async function loadNotebooks() {
  setLoading(true);
  try {
    const hasPermission = await browser.permissions.contains({
      origins: [ConduitHosts.NOTEBOOKLM_ORIGIN],
    });
    if (!hasPermission) {
      showView('gate');
      setLoading(false);
      return;
    }

    const response = await browser.runtime.sendMessage({ type: 'NLM_LIST_NOTEBOOKS' });
    if (!response.ok) throw response.error;

    const notebooks = response.data;
    populateDropdown(notebooks);
    setLoading(false);
  } catch (err) {
    setLoading(false);
    handleError(err);
  }
}

function populateDropdown(notebooks) {
  const select = elements.notebookSelect;
  select.innerHTML = '';
  elements.newTitleInput.classList.add('hidden');

  const defaultOpt = document.createElement('option');
  defaultOpt.text = 'Select a notebook...';
  defaultOpt.value = '';
  defaultOpt.disabled = true;
  defaultOpt.selected = true;
  select.appendChild(defaultOpt);

  notebooks.forEach((nb) => {
    const opt = document.createElement('option');
    opt.value = nb.id;
    opt.text = nb.title;
    opt.dataset.title = nb.title;
    select.appendChild(opt);
  });

  const createOpt = document.createElement('option');
  createOpt.value = '__create__';
  createOpt.text = 'Create new notebook...';
  select.appendChild(createOpt);
}

function handleSelectionChange() {
  const val = elements.notebookSelect.value;
  if (val === '__create__') {
    elements.newTitleInput.classList.remove('hidden');
  } else {
    elements.newTitleInput.classList.add('hidden');
  }
  updateSendEnabled();
}

function updateSendEnabled() {
  const val = elements.notebookSelect.value;
  const isCreate = val === '__create__';
  const newTitle = elements.newTitleInput.value.trim();
  const destinationReady = Boolean(val) && (!isCreate || newTitle.length > 0);
  const hasIntent = Boolean(state.selectedIntent);
  elements.btnSend.disabled = !destinationReady || !state.permissionsReady || !hasIntent;
}

async function injectInPageUi(tabId) {
  if (!tabId || typeof tabId !== 'number') return;
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      files: ['shared/hosts.js', 'shared/triggers.js', 'content/inpage_ui.js'],
    });

    const lastError = browser.runtime.lastError;
    if (lastError) {
      throw new Error(lastError.message || 'Failed to inject in-page UI');
    }
  } catch (error) {
    const message = error && error.message ? error.message : 'Failed to inject in-page UI';
    showError('injection', message);
  }
}

async function handleSend() {
  if (!state.context) {
    showError('tab_missing', 'No active tab available');
    return;
  }

  const val = elements.notebookSelect.value;
  const isCreate = val === '__create__';
  const newTitle = elements.newTitleInput.value.trim();
  const intent = state.selectedIntent || (state.intentPolicy && state.intentPolicy.defaultIntent);

  if (isCreate && !newTitle) {
    showError('notebook_create', 'Please enter a name for the new notebook');
    return;
  }
  if (!intent) {
    showError('intent', 'Select a send intent to continue');
    return;
  }

  let destination = null;
  if (isCreate) {
    destination = { type: 'create', title: newTitle };
  } else {
    const selectedOption = elements.notebookSelect.selectedOptions[0];
    destination = {
      type: 'select',
      id: val,
      title: selectedOption ? selectedOption.dataset.title : '',
    };
  }

  const trigger = {
    triggerType: state.context.triggerType || ConduitTriggers.TRIGGER_TYPES.toolbar,
    intent,
    tabId: state.context.tabId,
    url: state.context.url,
    requestId: state.context.requestId || ConduitTriggers.createRequestId(),
  };

  showStatus('Sending...', 'Ingesting content...');

  try {
    const response = await browser.runtime.sendMessage({
      type: 'TRIGGER_SEND_FLOW',
      trigger,
      destination,
    });

    if (!response.ok) throw response.error;

    showSuccess(response.data);
  } catch (err) {
    handleError(err);
  }
}

function handleError(err) {
  const code = err && err.code ? err.code : 'unknown';
  const msg = err && err.message ? err.message : 'An unknown error occurred';
  showError(code, msg, err && err.detail);
}

function showView(viewName) {
  elements.gateView.classList.add('hidden');
  elements.siteGateView.classList.add('hidden');
  elements.formView.classList.add('hidden');
  elements.statusView.classList.add('hidden');

  if (viewName === 'gate') elements.gateView.classList.remove('hidden');
  if (viewName === 'siteGate') elements.siteGateView.classList.remove('hidden');
  if (viewName === 'form') elements.formView.classList.remove('hidden');
  if (viewName === 'status') elements.statusView.classList.remove('hidden');
}

function setLoading(isLoading) {
  elements.btnSend.disabled = isLoading || !state.permissionsReady;
  if (isLoading) {
    elements.notebookSelect.innerHTML = '<option>Loading...</option>';
  }
}

function showStatus(title, detail) {
  showView('status');
  elements.statusMessage.textContent = title;
  elements.statusDetail.textContent = detail || '';
  elements.statusMessage.className = '';
  elements.statusDetailBox.classList.add('hidden');
  elements.btnReset.classList.add('hidden');
}

function showSuccess(data) {
  showView('status');
  elements.statusMessage.textContent = 'Saved to NotebookLM';
  elements.statusMessage.className = 'success';
  const sourceType = formatSourceType(data.sourceType);
  elements.statusDetail.textContent = `Sent ${sourceType} to "${data.notebookTitle}"`;
  elements.statusDetailBox.classList.add('hidden');
  elements.btnReset.classList.remove('hidden');
  elements.newTitleInput.value = '';
}

function formatSourceType(sourceType) {
  if (!sourceType) return 'content';
  const value = String(sourceType).toLowerCase();
  if (value === 'gdoc') return 'Google Doc';
  if (value === 'youtube') return 'YouTube video';
  if (value === 'selection') return 'selected text';
  if (value === 'web') return 'web page';
  if (value.includes('chatgpt')) return 'ChatGPT conversation';
  if (value.includes('gemini')) return 'Gemini conversation';
  return value;
}

function formatDetail(detail) {
  if (!detail) return '';
  if (typeof detail === 'string') return detail;
  try {
    return JSON.stringify(detail, null, 2);
  } catch (e) {
    return String(detail);
  }
}

function truncateDetail(detailText, maxLen) {
  if (!detailText) return '';
  if (detailText.length <= maxLen) return detailText;
  return detailText.slice(0, maxLen) + '...';
}

function showError(code, msg, detail) {
  showView('status');
  elements.statusMessage.textContent = 'Connection Failed';
  elements.statusMessage.className = 'error';
  elements.statusDetail.textContent = `[${code}] ${msg}`;
  const detailText = truncateDetail(formatDetail(detail), 1200);
  if (detailText) {
    elements.statusDetailBox.classList.remove('hidden');
    elements.statusDetailText.textContent = detailText;
  } else {
    elements.statusDetailBox.classList.add('hidden');
    elements.statusDetailText.textContent = '';
  }
  elements.btnReset.classList.remove('hidden');
}

function resetUI() {
  checkState();
}
