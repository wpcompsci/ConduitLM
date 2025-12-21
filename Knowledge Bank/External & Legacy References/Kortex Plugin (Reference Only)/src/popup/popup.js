// src/popup/popup.js

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const selectionText = params.get('selectionText');
    const pageUrl = params.get('pageUrl');
    const pageTitle = params.get('pageTitle');

    const searchInput = document.getElementById('search-input');
    const createNewContainer = document.getElementById('create-new-container');
    const itemsContainer = document.getElementById('notebook-items-container');
    const mainContainer = document.querySelector('.container');

    function handleSave(notebookId) {
        // Replace the entire container's content with the status message
        mainContainer.innerHTML = '<div class="disabled">Saving...</div>';
        
        chrome.runtime.sendMessage({
            type: 'SAVE_SNIPPET',
            data: { selectionText, pageUrl, pageTitle, notebookId }
        }, (response) => {
            if (response.success) {
                mainContainer.innerHTML = '<div class="disabled">Snippet Saved! ✨</div>';
            } else {
                mainContainer.innerHTML = `<div class="disabled">Error: ${response.message}</div>`;
            }
            setTimeout(() => window.close(), 2000);
        });
    }
    
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        // Only search through items in the scrollable container
        const allItems = itemsContainer.querySelectorAll('.notebook-item');
        allItems.forEach(item => {
            const itemName = item.textContent.toLowerCase();
            item.style.display = itemName.includes(searchTerm) ? 'flex' : 'none';
        });
    });

    chrome.runtime.sendMessage({ type: 'GET_NOTEBOOK_LIST' }, (response) => {
        if (response.success && response.notebooks) {
            // Append the "Create New" button to its dedicated container
            const createNewDiv = document.createElement('div');
            createNewDiv.className = 'btn-primary'; 
            createNewDiv.innerHTML = `<span>➕</span><span>Create New Notebook</span>`;
            createNewDiv.addEventListener('click', () => handleSave(null));
            createNewContainer.appendChild(createNewDiv);

            // Append the list of existing notebooks to their scrollable container
            response.notebooks.forEach(notebook => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'notebook-item';
                itemDiv.innerHTML = `<span>${notebook.emoji}</span><span>${notebook.name}</span>`;
                itemDiv.addEventListener('click', () => handleSave(notebook.id));
                itemsContainer.appendChild(itemDiv);
            });

        } else {
            mainContainer.innerHTML = '<div class="disabled">Error: Could not load notebooks.</div>';
        }
    });
});