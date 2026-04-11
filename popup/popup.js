// Settings popup logic
const browser = window.browser || window.chrome;

const elements = {
    apiKey: document.getElementById('api-key'),
    modelId: document.getElementById('model-id'),
    saveBtn: document.getElementById('save-btn'),
    openSidebarBtn: document.getElementById('open-sidebar-btn'),
    status: document.getElementById('status')
};

// Open Sidebar handler
elements.openSidebarBtn.addEventListener('click', async () => {
    try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            // chrome.sidePanel.open is only available in Chrome 116+
            // In Firefox it might be different, but manifest v3 sidePanel is mainly Chrome
            if (browser.sidePanel && browser.sidePanel.open) {
                await browser.sidePanel.open({ tabId: tab.id });
            } else {
                // Fallback or message if not supported
                showStatus("Sidebar API not supported", false);
            }
        }
    } catch (err) {
        console.error(err);
        showStatus("Error opening sidebar", false);
    }
});

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
