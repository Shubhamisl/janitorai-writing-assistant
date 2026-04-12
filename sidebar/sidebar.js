// Sidebar logic
const browser = globalThis.browser ?? globalThis.chrome;

const elements = {
    inputText: document.getElementById('input-text'),
    styleSelect: document.getElementById('style-select'),
    enhanceBtn: document.getElementById('enhance-btn'),
    suggestBtn: document.getElementById('suggest-btn'),
    suggestionChips: document.getElementById('suggestion-chips'),
    outputSection: document.getElementById('output-section'),
    outputText: document.getElementById('output-text'),
    applyBtn: document.getElementById('apply-btn'),
    copyBtn: document.getElementById('copy-btn'),
    modelDisplay: document.getElementById('model-display'),
    statusIndicator: document.querySelector('.status-indicator'),
    // Status Bar
    statusBar: document.getElementById('status-bar'),
    statusIcon: document.getElementById('status-icon'),
    statusText: document.getElementById('status-text'),
    // Settings footer
    settingsToggle: document.getElementById('settings-toggle'),
    settingsPanel: document.getElementById('settings-panel'),
    settingsApiKey: document.getElementById('settings-api-key'),
    settingsModelId: document.getElementById('settings-model-id'),
    settingsSaveBtn: document.getElementById('settings-save-btn')
};

/**
 * Updates the permanent status bar with text and icons.
 * @param {string} text 
 * @param {string} icon 
 * @param {'ready'|'working'|'offline'|'error'|'success'} state 
 */
function setStatusBar(text, icon = '✨', state = 'ready') {
    elements.statusText.textContent = text;
    elements.statusIcon.textContent = icon;

    elements.statusBar.className = 'status-bar';
    if (state !== 'ready') {
        elements.statusBar.classList.add(state);
    }
    
    // Sync the header indicator dot for 'working' and 'offline' states
    if (state === 'working') {
        elements.statusIndicator.className = 'status-indicator working';
    } else if (state === 'offline' || state === 'error') {
        elements.statusIndicator.className = 'status-indicator offline';
    } else {
        // 'ready' or 'success' usually means the site is still online
        elements.statusIndicator.className = 'status-indicator online';
    }
}

// ---------------------------------------------------------------------------
// Load preferences on start
// ---------------------------------------------------------------------------
browser.storage.local.get(['style', 'model', 'apiKey']).then(data => {
    if (data.style) elements.styleSelect.value = data.style;
    if (data.model) {
        elements.modelDisplay.textContent = data.model;
        elements.settingsModelId.value = data.model;
    }
    if (data.apiKey) elements.settingsApiKey.value = data.apiKey;
});

// Keep model display in sync when settings are saved
browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.model) {
        elements.modelDisplay.textContent = changes.model.newValue || 'Claude 3.5 Sonnet';
    }
});

// ---------------------------------------------------------------------------
// Settings footer -- collapsible toggle
// ---------------------------------------------------------------------------
elements.settingsToggle.addEventListener('click', () => {
    const expanded = elements.settingsToggle.getAttribute('aria-expanded') === 'true';
    elements.settingsToggle.setAttribute('aria-expanded', String(!expanded));
    if (expanded) {
        elements.settingsPanel.hidden = true;
    } else {
        elements.settingsPanel.hidden = false;
    }
});

// Settings save handler
elements.settingsSaveBtn.addEventListener('click', async () => {
    const apiKey = elements.settingsApiKey.value.trim();
    const model = elements.settingsModelId.value.trim();

    if (!apiKey) {
        showSettingsStatus('API Key is required', false);
        return;
    }

    await browser.storage.local.set({ apiKey, model });
    showSettingsStatus('Saved!', true);
    console.log('JanitorAI Writing Assistant: Saved extension settings successfully.');
});

function showSettingsStatus(msg, isSuccess) {
    if (isSuccess) {
        setStatusBar('Settings saved!', '⚙️', 'success');
        setTimeout(() => checkCurrentContext(), 3000);
    } else {
        setStatusBar(`Save failed: ${msg}`, '⚠️', 'error');
    }
}

// ---------------------------------------------------------------------------
// Inject content scripts into the active tab if they are not already present,
// then request the chat history. This avoids the need to reload the tab when
// the extension is first opened against an already-loaded page.
// ---------------------------------------------------------------------------
async function fetchHistory() {
    const tab = await getActiveTab();
    if (!tab) return [];
    const tabId = tab.id;

    // First attempt - content script may already be running.
    try {
        const res = await browser.tabs.sendMessage(tabId, { type: 'getHistory' });
        if (res && res.history) return res.history;
    } catch (_) {
        // Content script not yet injected into this tab - fall through to inject.
    }

    // Inject the scripts programmatically and retry once.
    try {
        await browser.scripting.executeScript({
            target: { tabId },
            files: ['utils/scraping.js', 'content.js']
        });
        // Give the newly-injected listener a tick to register.
        await new Promise(resolve => setTimeout(resolve, 100));
        const res = await browser.tabs.sendMessage(tabId, { type: 'getHistory' });
        if (res && res.history) return res.history;
    } catch (injectErr) {
        console.warn('JanitorAI Writing Assistant: Could not inject content scripts:', injectErr);
    }

    return [];
}

// ---------------------------------------------------------------------------
// Save style preference
// ---------------------------------------------------------------------------
elements.styleSelect.addEventListener('change', () => {
    browser.storage.local.set({ style: elements.styleSelect.value });
});

// ---------------------------------------------------------------------------
// Enhance button handler
// ---------------------------------------------------------------------------
elements.enhanceBtn.addEventListener('click', async () => {
    const text = elements.inputText.value.trim();
    if (!text) return showError('Please enter some text first.');

    setLoading(true);
    setStatusBar('Enhancing text...', '🪄', 'working');

    try {
        // Step 1: Get History from Content Script
        const history = await fetchHistory();

        // Get saved model preference
        const data = await browser.storage.local.get('model');
        const modelId = data.model;

        // Step 2: Send to Background for Enhancement
        const response = await browser.runtime.sendMessage({
            type: 'enhanceText',
            text: text,
            style: elements.styleSelect.value,
            history: history,
            model: modelId
        });

        if (response.success) {
            elements.outputText.textContent = response.result;
            elements.outputSection.classList.remove('hidden');
            setStatusBar('Text enhanced!', '✅', 'success');
            setTimeout(() => checkCurrentContext(), 3000);
        } else {
            showError(response.error || 'Enhancement failed. Check your API key in Settings.');
            checkCurrentContext();
        }
    } catch (err) {
        showError(`Communication error: ${err.message}`);
        checkCurrentContext();
    } finally {
        setLoading(false);
    }
});

// ---------------------------------------------------------------------------
// Suggestion button handler
// ---------------------------------------------------------------------------
elements.suggestBtn.addEventListener('click', async () => {
    setPlaceholder(elements.suggestionChips, 'Thinking...');
    setStatusBar('Brainstorming ideas...', '🧠', 'working');

    try {
        // Step 1: Get History (vital for suggestions)
        const history = await fetchHistory();

        if (history.length === 0) {
            setPlaceholder(elements.suggestionChips, 'No history found. Start chatting first!');
            setStatusBar('No history found', '❓', 'ready');
            setTimeout(() => checkCurrentContext(), 3000);
            return;
        }

        const data = await browser.storage.local.get('model');

        // Step 2: Call API
        const response = await browser.runtime.sendMessage({
            type: 'suggestNext',
            history: history,
            model: data.model
        });

        if (response.success) {
            renderSuggestions(response.result);
            setStatusBar('Suggestions ready', '💡', 'success');
            setTimeout(() => checkCurrentContext(), 3000);
        } else {
            setPlaceholder(elements.suggestionChips, 'Error generating ideas.');
            showError(response.error);
            checkCurrentContext();
        }

    } catch (err) {
        setPlaceholder(elements.suggestionChips, 'Connection error.');
        showError(err.message);
        checkCurrentContext();
    }
});

function renderSuggestions(text) {
    elements.suggestionChips.replaceChildren();

    // Parse the list (Expect: "1. Idea one\n2. Idea two...")
    const lines = text.split(/\n/);
    const suggestions = lines.filter(l => l.match(/^\d+\./) || l.trim().startsWith('-')).slice(0, 3);

    const fragment = document.createDocumentFragment();

    if (suggestions.length === 0) {
        const chip = createChip(`${text.substring(0, 100)}...`);
        fragment.appendChild(chip);
    } else {
        suggestions.forEach(line => {
            const cleanText = line.replace(/^\d+\.|^-\s*/, '').trim();
            const chip = createChip(cleanText);
            fragment.appendChild(chip);
        });
    }

    elements.suggestionChips.appendChild(fragment);
}

function createChip(text) {
    const chip = document.createElement('div');
    chip.className = 'suggestion-chip';
    chip.textContent = text;
    chip.title = 'Click to use';
    chip.onclick = () => {
        elements.inputText.value = text;
        setStatusBar('Draft updated', '📝', 'ready');
        setTimeout(() => checkCurrentContext(), 2000);
    };
    return chip;
}

// ---------------------------------------------------------------------------
// Apply button handler
// ---------------------------------------------------------------------------
elements.applyBtn.addEventListener('click', async () => {
    try {
        const tab = await getActiveTab();
        if (!tab) return;

        const text = elements.outputText.textContent;
        browser.tabs.sendMessage(tab.id, {
            type: 'applyText',
            text: text
        });
        setStatusBar('Text applied to chat', '⏎', 'success');
        setTimeout(() => checkCurrentContext(), 3000);
    } catch (err) {
        showError(err.message);
    }
});

// ---------------------------------------------------------------------------
// Copy button handler
// ---------------------------------------------------------------------------
elements.copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(elements.outputText.textContent);
    const originalText = elements.copyBtn.textContent;
    elements.copyBtn.textContent = '✅';
    setStatusBar('Copied to clipboard', '📋', 'success');
    setTimeout(() => {
        elements.copyBtn.textContent = originalText;
        checkCurrentContext();
    }, 2000);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function getActiveTab() {
    try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        if (!tab) return null;

        let isValidUrl = false;
        if (tab.url) {
            try {
                const urlObj = new URL(tab.url);
                const hostname = urlObj.hostname;
                if (hostname === 'janitorai.com' || hostname.endsWith('.janitorai.com')) {
                    isValidUrl = true;
                }
            } catch (e) {
                // Ignore invalid URLs
            }
        }

        return isValidUrl ? tab : null;
    } catch (err) {
        return null;
    }
}

/**
 * Checks if the user is currently on a JanitorAI tab and updates the UI state.
 */
async function checkCurrentContext() {
    const tab = await getActiveTab();
    const isOnline = !!tab;
    updateUIContext(isOnline);

    if (isOnline) {
        // If we just navigated back to JanitorAI, try to fetch history to be ready
        // But don't block the UI
        fetchHistory().catch(() => { });
    }
}

function updateUIContext(isOnline) {
    const statusIndicator = document.querySelector('.status-indicator');
    const suggestionsSection = document.querySelector('.suggestions-section');
    const controlsSection = document.querySelector('.controls-section');

    if (isOnline) {
        statusIndicator.className = 'status-indicator online';
        statusIndicator.title = 'Ready';
        suggestionsSection.classList.remove('dimmed');
        controlsSection.classList.remove('dimmed');

        elements.enhanceBtn.disabled = false;
        elements.suggestBtn.disabled = false;
        elements.applyBtn.disabled = false;

        setStatusBar('Ready to enhance', '✨', 'ready');
    } else {
        statusIndicator.className = 'status-indicator offline';
        statusIndicator.title = 'Waiting for JanitorAI';
        suggestionsSection.classList.add('dimmed');
        controlsSection.classList.add('dimmed');

        elements.enhanceBtn.disabled = true;
        elements.suggestBtn.disabled = true;
        elements.applyBtn.disabled = true;

        setStatusBar('Switch to JanitorAI tab', '📡', 'offline');
    }
}

// ---------------------------------------------------------------------------
// Event Listeners for Tab Switching
// ---------------------------------------------------------------------------

// Detect when the user switches to a different tab
browser.tabs.onActivated.addListener(checkCurrentContext);

// Detect when the URL of the current tab changes (e.g. navigation within JanitorAI or away)
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' || changeInfo.url) {
        checkCurrentContext();
    }
});

// Initial check on load
checkCurrentContext();

function setLoading(isLoading) {
    elements.enhanceBtn.disabled = isLoading;
    elements.enhanceBtn.replaceChildren();
    const iconSpan = document.createElement('span');
    iconSpan.className = 'icon';
    iconSpan.textContent = isLoading ? '⏳' : '✨';
    elements.enhanceBtn.appendChild(iconSpan);
    elements.enhanceBtn.appendChild(document.createTextNode(isLoading ? ' Enhancing...' : ' Enhance Text'));
}

function setPlaceholder(container, text) {
    container.replaceChildren();
    const span = document.createElement('span');
    span.className = 'placeholder-text';
    span.textContent = text;
    container.appendChild(span);
}

function showError(msg) {
    setStatusBar(`Error: ${msg}`, '⚠️', 'error');
}
