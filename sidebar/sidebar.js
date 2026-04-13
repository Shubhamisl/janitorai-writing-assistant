import { getActiveJanitorTab } from '../utils/browser_utils.js';

// Sidebar logic
const browser = globalThis.browser ?? globalThis.chrome;

const elements = {
    inputText: document.getElementById('input-text'),
    styleSelect: document.getElementById('style-select'),
    enhanceBtn: document.getElementById('enhance-btn'),
    suggestBtn: document.getElementById('suggest-btn'),
    suggestionChips: document.getElementById('suggestion-chips'),
    charCount: document.getElementById('char-count'),
    modelDisplay: document.getElementById('model-display'),
    statusIndicator: document.querySelector('.status-indicator'),
    // Draft Actions
    undoBtn: document.getElementById('undo-btn'),
    copyDraftBtn: document.getElementById('copy-draft-btn'),
    insertDraftBtn: document.getElementById('insert-draft-btn'),
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

// State management
let previousDraft = '';

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

// Input interaction logic
elements.inputText.addEventListener('input', () => {
    updateCharCount(elements.inputText.value.length);
    // If user typed, they might have manually changed what was enhanced, 
    // but keep undo for a bit if it was recent? 
    // For now, let's keep it until next enhancement or manual undo.
});

function updateCharCount(count) {
    elements.charCount.textContent = `${count} chars`;
}

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
    const isExpanding = elements.settingsToggle.getAttribute('aria-expanded') !== 'true';
    elements.settingsToggle.setAttribute('aria-expanded', String(isExpanding));
    elements.settingsPanel.classList.toggle('open', isExpanding);
});

// Close settings panel when clicking outside
document.addEventListener('click', (e) => {
    const isExpanded = elements.settingsToggle.getAttribute('aria-expanded') === 'true';
    if (!isExpanded) return;

    const isClickInsidePanel = elements.settingsPanel.contains(e.target);
    const isClickOnToggle = elements.settingsToggle.contains(e.target);

    if (!isClickInsidePanel && !isClickOnToggle) {
        elements.settingsToggle.setAttribute('aria-expanded', 'false');
        elements.settingsPanel.classList.remove('open');
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

    const originalContent = elements.settingsSaveBtn.innerHTML;
    elements.settingsSaveBtn.disabled = true;
    elements.settingsSaveBtn.innerHTML = '<span class="icon">⏳</span> Saving...';

    try {
        await browser.storage.local.set({ apiKey, model });
        elements.settingsSaveBtn.innerHTML = '<span class="icon">✅</span> Saved!';
        showSettingsStatus('Saved!', true);
        console.log('JanitorAI Writing Assistant: Saved extension settings successfully.');
    } catch (err) {
        elements.settingsSaveBtn.innerHTML = '<span class="icon">❌</span> Error';
        showSettingsStatus(err.message, false);
    } finally {
        setTimeout(() => {
            elements.settingsSaveBtn.disabled = false;
            elements.settingsSaveBtn.innerHTML = originalContent;
        }, 3000);
    }
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
    const tab = await getActiveJanitorTab();
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
            // Save original for undo
            previousDraft = elements.inputText.value;
            elements.undoBtn.disabled = false;

            // Overwrite draft
            elements.inputText.value = response.result;
            updateCharCount(response.result.length);

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
// Undo button handler
// ---------------------------------------------------------------------------
elements.undoBtn.addEventListener('click', () => {
    if (previousDraft !== undefined) {
        elements.inputText.value = previousDraft;
        updateCharCount(previousDraft.length);
        elements.undoBtn.disabled = true;
        setStatusBar('Enhancement undone', '↺', 'success');
        setTimeout(() => checkCurrentContext(), 2000);
    }
});

// ---------------------------------------------------------------------------
// Draft Copy button handler
// ---------------------------------------------------------------------------
elements.copyDraftBtn.addEventListener('click', () => {
    const text = elements.inputText.value;
    if (!text) return;

    navigator.clipboard.writeText(text);
    const originalContent = elements.copyDraftBtn.innerHTML;
    elements.copyDraftBtn.textContent = '✅';
    setStatusBar('Copied to clipboard', '📋', 'success');
    setTimeout(() => {
        elements.copyDraftBtn.innerHTML = originalContent;
        checkCurrentContext();
    }, 2000);
});

// ---------------------------------------------------------------------------
// Draft Insert button handler
// ---------------------------------------------------------------------------
elements.insertDraftBtn.addEventListener('click', async () => {
    const text = elements.inputText.value;
    if (!text) return;

    try {
        const tab = await getActiveJanitorTab();
        if (!tab) return;

        browser.tabs.sendMessage(tab.id, {
            type: 'applyText',
            text: text
        });
        setStatusBar('Text applied to chat', '📥', 'success');
        setTimeout(() => checkCurrentContext(), 3000);
    } catch (err) {
        showError(err.message);
    }
});

// ---------------------------------------------------------------------------
// Suggestion button handler
// ---------------------------------------------------------------------------
elements.suggestBtn.addEventListener('click', async () => {
    showSuggestionSkeletons();
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
    const chip = document.createElement('button');
    chip.className = 'suggestion-chip';
    chip.type = 'button';
    chip.textContent = text;
    chip.title = 'Click to use';
    chip.onclick = () => {
        // When using a chip, we treat it like an overwrite, but maybe we shouldn't allow undo for chips?
        // User didn't ask for it specifically for suggestions, but it's consistent.
        previousDraft = elements.inputText.value;
        elements.undoBtn.disabled = false;

        elements.inputText.value = text;
        updateCharCount(text.length);
        setStatusBar('Draft updated', '📝', 'success');
        setTimeout(() => checkCurrentContext(), 2000);
    };
    return chip;
}

// ---------------------------------------------------------------------------
// Context Management
// ---------------------------------------------------------------------------
/**
 * Checks if the user is currently on a JanitorAI tab and updates the UI state.
 */
async function checkCurrentContext() {
    const tab = await getActiveJanitorTab();
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
        elements.insertDraftBtn.disabled = false;

        setStatusBar('Ready to enhance', '✨', 'ready');
    } else {
        statusIndicator.className = 'status-indicator offline';
        statusIndicator.title = 'Waiting for JanitorAI';
        suggestionsSection.classList.add('dimmed');
        controlsSection.classList.add('dimmed');

        elements.enhanceBtn.disabled = true;
        elements.suggestBtn.disabled = true;
        elements.insertDraftBtn.disabled = true;

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
    const inputSection = document.querySelector('.input-section');

    if (isLoading) {
        inputSection.classList.add('working-pulse');
    } else {
        inputSection.classList.remove('working-pulse');
    }

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

function showSuggestionSkeletons() {
    elements.suggestionChips.replaceChildren();
    for (let i = 0; i < 3; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-chip';
        elements.suggestionChips.appendChild(skeleton);
    }
}

function showError(msg) {
    setStatusBar(`Error: ${msg}`, '⚠️', 'error');
}
