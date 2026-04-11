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
    errorBox: document.getElementById('error-message'),
    modelDisplay: document.getElementById('model-display'),
    // Settings footer
    settingsToggle: document.getElementById('settings-toggle'),
    settingsPanel: document.getElementById('settings-panel'),
    settingsApiKey: document.getElementById('settings-api-key'),
    settingsModelId: document.getElementById('settings-model-id'),
    settingsSaveBtn: document.getElementById('settings-save-btn'),
    settingsStatus: document.getElementById('settings-status')
};

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
    elements.settingsStatus.textContent = msg;
    elements.settingsStatus.className = `settings-status ${isSuccess ? 'success' : 'error'}`;
    clearTimeout(elements.settingsStatus._timer);
    elements.settingsStatus._timer = setTimeout(() => {
        elements.settingsStatus.textContent = '';
        elements.settingsStatus.className = 'settings-status';
    }, 2500);
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
    hideError();

    try {
        // Step 1: Get History from Content Script
        const history = await fetchHistory();

        // Get saved model preference
        const data = await browser.storage.local.get('model');
        const modelId = data.model;

        console.log(`JanitorAI Writing Assistant: Sending 'enhanceText' command for model [${modelId}]`);

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
        } else {
            showError(response.error || 'Enhancement failed. Check your API key in Settings.');
        }
    } catch (err) {
        showError(`Communication error: ${err.message}`);
    } finally {
        setLoading(false);
    }
});

// ---------------------------------------------------------------------------
// Suggestion button handler
// ---------------------------------------------------------------------------
elements.suggestBtn.addEventListener('click', async () => {
    elements.suggestionChips.innerHTML = '<span class="placeholder-text">Thinking...</span>';

    try {
        // Step 1: Get History (vital for suggestions)
        const history = await fetchHistory();

        if (history.length === 0) {
            console.log('JanitorAI Writing Assistant: No history found to generate suggestions off of.');
            elements.suggestionChips.innerHTML = '<span class="placeholder-text">No history found. Start chatting first!</span>';
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
        } else {
            elements.suggestionChips.innerHTML = '<span class="placeholder-text">Error generating ideas.</span>';
            showError(response.error);
        }

    } catch (err) {
        elements.suggestionChips.innerHTML = '<span class="placeholder-text">Connection error.</span>';
        showError(err.message);
    }
});

function renderSuggestions(text) {
    elements.suggestionChips.innerHTML = '';

    // Parse the list (Expect: "1. Idea one\n2. Idea two...")
    const lines = text.split(/\n/);
    const suggestions = lines.filter(l => l.match(/^\d+\./) || l.trim().startsWith('-')).slice(0, 3);

    if (suggestions.length === 0) {
        const chip = createChip(`${text.substring(0, 100)}...`);
        elements.suggestionChips.appendChild(chip);
        return;
    }

    suggestions.forEach(line => {
        const cleanText = line.replace(/^\d+\.|^-\s*/, '').trim();
        const chip = createChip(cleanText);
        elements.suggestionChips.appendChild(chip);
    });
}

function createChip(text) {
    const chip = document.createElement('div');
    chip.className = 'suggestion-chip';
    chip.textContent = text;
    chip.title = 'Click to use';
    chip.onclick = () => {
        elements.inputText.value = text;
    };
    return chip;
}

// ---------------------------------------------------------------------------
// Apply button handler -- sends text to content script
// ---------------------------------------------------------------------------
elements.applyBtn.addEventListener('click', async () => {
    try {
        const tab = await getActiveTab();
        if (!tab) return;

        const text = elements.outputText.textContent;
        console.log('JanitorAI Writing Assistant: Applying enhanced text to active tab chat.');
        browser.tabs.sendMessage(tab.id, {
            type: 'applyText',
            text: text
        });
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
    setTimeout(() => elements.copyBtn.textContent = originalText, 2000);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function getActiveTab() {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab) return null;

    if (!tab.url || !tab.url.includes('janitorai.com')) {
        throw new Error('Please switch to a JanitorAI tab first.');
    }
    return tab;
}

function setLoading(isLoading) {
    elements.enhanceBtn.disabled = isLoading;
    elements.enhanceBtn.innerHTML = isLoading
        ? '<span class="icon">⏳</span> Enhancing...'
        : '<span class="icon">✨</span> Enhance Text';
}

function showError(msg) {
    elements.errorBox.textContent = msg;
    elements.errorBox.classList.remove('hidden');
}

function hideError() {
    elements.errorBox.classList.add('hidden');
}
