// Settings popup logic

const elements = {
    apiKey: document.getElementById('api-key'),
    modelId: document.getElementById('model-id'),
    saveBtn: document.getElementById('save-btn'),
    status: document.getElementById('status')
};

// Load saved settings
browser.storage.local.get(['apiKey', 'model']).then(data => {
    if (data.apiKey) elements.apiKey.value = data.apiKey;
    if (data.model) elements.modelId.value = data.model;
});

// Save settings handler
elements.saveBtn.addEventListener('click', async () => {
    const apiKey = elements.apiKey.value.trim();
    const model = elements.modelId.value.trim();

    if (!apiKey) {
        showStatus("API Key is required", false);
        return;
    }

    await browser.storage.local.set({
        apiKey: apiKey,
        model: model // If empty, background script uses default
    });

    showStatus("Settings Saved!", true);
    setTimeout(() => {
        elements.status.textContent = "";
    }, 2000);
});

function showStatus(msg, isSuccess) {
    elements.status.textContent = msg;
    elements.status.className = "status-msg " + (isSuccess ? "success" : "");
}
