// Popup Logic

const HOST_ORIGIN = "https://notebooklm.google.com/*";

document.addEventListener("DOMContentLoaded", init);

const elements = {
    gateView: document.getElementById("gate-view"),
    formView: document.getElementById("form-view"),
    statusView: document.getElementById("status-view"),
    btnEnable: document.getElementById("btn-enable-access"),
    btnSend: document.getElementById("btn-confirm-send"),
    btnReset: document.getElementById("btn-reset"),
    notebookSelect: document.getElementById("notebook-select"),
    createContainer: document.getElementById("create-container"),
    newTitleInput: document.getElementById("new-notebook-title"),
    statusMessage: document.getElementById("status-message"),
    statusDetail: document.getElementById("status-detail"),
    statusIcon: document.getElementById("status-icon")
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
        origins: [HOST_ORIGIN]
    });

    if (!hasPermission) {
        showView("gate");
    } else {
        showView("form");
        loadNotebooks();
    }
}

async function requestPermission() {
    const granted = await browser.permissions.request({
        origins: [HOST_ORIGIN]
    });

    if (granted) {
        checkState();
    } else {
        showError("permission", "Permission denied by user");
    }
}

async function loadNotebooks() {
    setLoading(true);
    try {
        const response = await browser.runtime.sendMessage({ type: "NLM_LIST_NOTEBOOKS" });
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
    select.innerHTML = "";

    // Default options
    const defaultOpt = document.createElement("option");
    defaultOpt.text = "Select a notebook...";
    defaultOpt.value = "";
    defaultOpt.disabled = true;
    defaultOpt.selected = true;
    select.appendChild(defaultOpt);

    notebooks.forEach(nb => {
        const opt = document.createElement("option");
        opt.value = nb.id;
        opt.text = nb.title;
        select.appendChild(opt);
    });

    // Create New Option
    const createOpt = document.createElement("option");
    createOpt.value = "__create__";
    createOpt.text = "➕ Create new notebook...";
    select.appendChild(createOpt);
}

function handleSelectionChange() {
    const val = elements.notebookSelect.value;
    if (val === "__create__") {
        elements.createContainer.classList.remove("hidden");
    } else {
        elements.createContainer.classList.add("hidden");
    }
    // Enable send if valid
    elements.btnSend.disabled = !val;
}

async function handleSend() {
    const val = elements.notebookSelect.value;
    const isCreate = val === "__create__";
    const newTitle = elements.newTitleInput.value.trim();

    if (isCreate && !newTitle) {
        showError("notebook_create", "Please enter a name for the new notebook");
        return;
    }

    const destination = isCreate
        ? { type: 'create', title: newTitle }
        : { type: 'select', id: val };

    showStatus("Sending...", "Ingesting selection...");

    try {
        const response = await browser.runtime.sendMessage({
            type: "SEND_SELECTION_TO_NLM",
            destination: destination
        });

        if (!response.ok) throw response.error;

        showSuccess(response.data);
    } catch (err) {
        handleError(err);
    }
}

function handleError(err) {
    // Canonical error mapping
    const code = err.code || "unknown";
    const msg = err.message || "An unknown error occurred";

    let userMsg = msg;
    if (code === "auth") userMsg = "Please sign in to NotebookLM in another tab.";
    if (code === "permission") userMsg = "Permission check failed. Please grant access.";
    if (code === "selection_empty") userMsg = "Text selection is empty.";

    showError(code, userMsg, err.detail);
}

function showView(viewName) {
    elements.gateView.classList.add("hidden");
    elements.formView.classList.add("hidden");
    elements.statusView.classList.add("hidden");

    if (viewName === "gate") elements.gateView.classList.remove("hidden");
    if (viewName === "form") elements.formView.classList.remove("hidden");
    if (viewName === "status") elements.statusView.classList.remove("hidden");
}

function setLoading(isLoading) {
    elements.btnSend.disabled = isLoading;
    if (isLoading) {
        elements.notebookSelect.innerHTML = "<option>Loading...</option>";
    }
}

function showStatus(title, detail) {
    showView("status");
    elements.statusMessage.textContent = title;
    elements.statusDetail.textContent = detail || "";
    elements.statusMessage.className = "";
    elements.btnReset.classList.add("hidden");
}

function showSuccess(data) {
    showView("status");
    elements.statusMessage.textContent = "Saved to NotebookLM";
    elements.statusMessage.className = "success";
    elements.statusDetail.textContent = `Ingested into "${data.notebookTitle}"`;
    elements.btnReset.classList.remove("hidden");
    // Clear form
    elements.newTitleInput.value = "";
}

function showError(code, msg, detail) {
    showView("status");
    elements.statusMessage.textContent = "Connection Failed";
    elements.statusMessage.className = "error";
    elements.statusDetail.textContent = `[${code}] ${msg} ${detail ? '(' + detail + ')' : ''}`;
    elements.btnReset.classList.remove("hidden");
}

function resetUI() {
    checkState();
}
