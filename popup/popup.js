// Settings popup logic
const browser = globalThis.browser ?? globalThis.chrome;

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
            if (browser.sidePanel?.open) {
                // Chrome / Edge 116+
                console.log("JanitorAI Writing Assistant: Emitting open sidepanel command using Chrome API.");
                await browser.sidePanel.open({ tabId: tab.id });
            } else if (browser.sidebarAction?.open) {
                // Firefox
                console.log("JanitorAI Writing Assistant: Emitting open sidebar command using Firefox API.");
                await browser.sidebarAction.open();
            } else {
                console.warn("JanitorAI Writing Assistant: Sidepanel API unsupported, manual interaction required.");
                showStatus("Click the toolbar icon to open the sidebar", false);
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

    console.log("JanitorAI Writing Assistant: Saved extension settings successfully.");
    showStatus("Settings Saved!", true);
    setTimeout(() => {
        elements.status.textContent = "";
    }, 2000);
});

function showStatus(msg, isSuccess) {
    elements.status.textContent = msg;
    elements.status.className = "status-msg " + (isSuccess ? "success" : "");
}
