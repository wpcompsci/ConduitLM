// src/download/download.js
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const notebookId = params.get('notebookId');

    const searchInput = document.getElementById('search-input');
    const itemsContainer = document.getElementById('notebook-items-container');
    const loadingState = document.getElementById('loading-state');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const downloadBtn = document.getElementById('download-btn');
    const mainContainer = document.querySelector('.container');
    const popupTitle = document.getElementById('popup-title');

    let allSources = []; // To store the full list of sources

    // --- UI Update Functions ---

    function renderSources(sourcesToRender) {
        itemsContainer.innerHTML = ''; // Clear previous items
        if (sourcesToRender.length === 0) {
            itemsContainer.innerHTML = '<div class="disabled">No sources found.</div>';
        }
        sourcesToRender.forEach(source => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'notebook-item';
            itemDiv.innerHTML = `
                <input type="checkbox" data-id="${source.id}" checked>
                <span>${source.name}</span>
            `;
            itemsContainer.appendChild(itemDiv);
        });
    }

    function updateButtonState() {
        const selectedCount = itemsContainer.querySelectorAll('input[type="checkbox"]:checked').length;
        downloadBtn.disabled = selectedCount === 0;
        downloadBtn.querySelector('span:last-child').textContent = selectedCount > 0 ? `Download (${selectedCount})` : 'Download Selected';
    }

    // --- Event Listeners ---

    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        const filteredSources = allSources.filter(source => source.name.toLowerCase().includes(searchTerm));
        renderSources(filteredSources);
        updateButtonState(); // Update button in case filtering changes selection
    });

    selectAllCheckbox.addEventListener('change', () => {
        const checkboxes = itemsContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => checkbox.checked = selectAllCheckbox.checked);
        updateButtonState();
    });

    itemsContainer.addEventListener('change', (e) => {
        if (e.target.matches('input[type="checkbox"]')) {
            const allCheckboxes = itemsContainer.querySelectorAll('input[type="checkbox"]');
            const checkedCount = itemsContainer.querySelectorAll('input[type="checkbox"]:checked').length;
            selectAllCheckbox.checked = allCheckboxes.length === checkedCount;
            updateButtonState();
        }
    });


downloadBtn.addEventListener('click', async () => {
    const selectedIds = Array.from(itemsContainer.querySelectorAll('input[type="checkbox"]:checked'))
        .map(cb => cb.dataset.id);

    if (selectedIds.length === 0) return;

    const selectedFormat = document.querySelector('input[name="format"]:checked').value;

    mainContainer.innerHTML = '<div class="disabled">Preparing your zip file...</div>';

    // Get the popup's own tab ID to send to the background script
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const popupTabId = tabs[0]?.id;

    chrome.runtime.sendMessage({
        type: 'DOWNLOAD_SELECTED_SOURCES',
        data: { notebookId, selectedSourceIds: selectedIds, popupTabId, format: selectedFormat }
    }, (response) => {
        // This callback now only handles the initial response from the background script.
        // It does NOT close the window.
        if (response && response.success) {
            mainContainer.innerHTML = '<div class="disabled">Download started! Check your browser\'s downloads bar... ✨</div>';
        } else {
            mainContainer.innerHTML = `<div class="disabled">Error: ${response?.message || 'Unknown error'}</div>`;
            // Only close automatically on error.
            setTimeout(() => window.close(), 3000);
        }
    });
});

    // --- Initial Load ---

    if (!notebookId) {
        mainContainer.innerHTML = '<div class="disabled">Error: No Notebook ID provided.</div>';
        return;
    }

    chrome.runtime.sendMessage({ type: 'GET_NOTEBOOK_SOURCES', data: { notebookId } }, (response) => {
        loadingState.style.display = 'none';
        if (response && response.success && response.sources) {
            allSources = response.sources;
            popupTitle.textContent = `Sources in "${allSources[0]?.name.split(' ')[0] || 'Notebook'}"`;
            renderSources(allSources);
        } else {
            itemsContainer.innerHTML = `<div class="disabled">Error: ${response?.message || 'Could not load sources.'}</div>`;
        }
        updateButtonState();
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'DOWNLOAD_COMPLETE_CLOSE_POPUP') {
        window.close();
    }
});