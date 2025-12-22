// Popup Logic

const HOST_ORIGIN = 'https://notebooklm.google.com/*';

document.addEventListener('DOMContentLoaded', init);

const elements = {
  gateView: document.getElementById('gate-view'),
  formView: document.getElementById('form-view'),
  statusView: document.getElementById('status-view'),
  btnEnable: document.getElementById('btn-enable-access'),
  btnSend: document.getElementById('btn-confirm-send'),
  btnReset: document.getElementById('btn-reset'),
  intentSelect: document.getElementById('intent-select'),
  notebookSelect: document.getElementById('notebook-select'),
  createContainer: document.getElementById('create-container'),
  newTitleInput: document.getElementById('new-notebook-title'),
  statusMessage: document.getElementById('status-message'),
  statusDetail: document.getElementById('status-detail'),
  statusDetailBox: document.getElementById('status-detail-box'),
  statusDetailText: document.getElementById('status-detail-text'),
  statusIcon: document.getElementById('status-icon'),
};

async function init() {
  elements.btnEnable.onclick = requestPermission;
  elements.btnSend.onclick = handleSend;
  elements.btnReset.onclick = resetUI;
  elements.notebookSelect.onchange = handleSelectionChange;

  await checkState();
}

async function checkState() {
  const hasPermission = await browser.permissions.contains({
    origins: [HOST_ORIGIN],
  });

  if (!hasPermission) {
    showView('gate');
  } else {
    showView('form');
    loadNotebooks();
  }
}

async function requestPermission() {
  const granted = await browser.permissions.request({
    origins: [HOST_ORIGIN],
  });

  if (granted) {
    checkState();
  } else {
    showError('permission', 'Permission denied by user');
  }
}

async function loadNotebooks() {
  setLoading(true);
  try {
    const hasPermission = await browser.permissions.contains({
      origins: [HOST_ORIGIN],
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

  // Default options
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

  // Create New Option
  const createOpt = document.createElement('option');
  createOpt.value = '__create__';
  createOpt.text = '➕ Create new notebook...';
  select.appendChild(createOpt);
}

function handleSelectionChange() {
  const val = elements.notebookSelect.value;
  if (val === '__create__') {
    elements.createContainer.classList.remove('hidden');
  } else {
    elements.createContainer.classList.add('hidden');
  }
  // Enable send if valid
  elements.btnSend.disabled = !val;
}

async function handleSend() {
  const val = elements.notebookSelect.value;
  const isCreate = val === '__create__';
  const newTitle = elements.newTitleInput.value.trim();
  const intent = elements.intentSelect.value || 'auto';

  if (isCreate && !newTitle) {
    showError('notebook_create', 'Please enter a name for the new notebook');
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

  showStatus('Sending...', 'Ingesting content...');

  try {
    const response = await browser.runtime.sendMessage({
      type: 'NLM_SEND',
      payload: {
        intent: intent,
        destination: destination,
      },
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
  elements.formView.classList.add('hidden');
  elements.statusView.classList.add('hidden');

  if (viewName === 'gate') elements.gateView.classList.remove('hidden');
  if (viewName === 'form') elements.formView.classList.remove('hidden');
  if (viewName === 'status') elements.statusView.classList.remove('hidden');
}

function setLoading(isLoading) {
  elements.btnSend.disabled = isLoading;
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
  // Clear form
  elements.newTitleInput.value = '';
}

function formatSourceType(sourceType) {
  if (!sourceType) return 'content';
  const value = String(sourceType).toLowerCase();
  if (value === 'gdoc') return 'Google Doc';
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
