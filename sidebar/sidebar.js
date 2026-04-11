// Sidebar logic
const browser = window.browser || window.chrome;

const elements = {
    inputText: document.getElementById('input-text'),
    styleSelect: document.getElementById('style-select'),
    enhanceBtn: document.getElementById('enhance-btn'),
    toggleExtBtn: document.getElementById('toggle-extensions'), /* potential future */
    suggestBtn: document.getElementById('suggest-btn'),
    suggestionChips: document.getElementById('suggestion-chips'),
    outputSection: document.getElementById('output-section'),
    outputText: document.getElementById('output-text'),
    applyBtn: document.getElementById('apply-btn'),
    copyBtn: document.getElementById('copy-btn'),
    errorBox: document.getElementById('error-message'),
    modelDisplay: document.getElementById('model-display')
};

// Load preferences on start
browser.storage.local.get(['style', 'model']).then(data => {
    if (data.style) elements.styleSelect.value = data.style;
    if (data.model) elements.modelDisplay.textContent = data.model;
});

// Listen for model changes from popup
browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.model) {
        elements.modelDisplay.textContent = changes.model.newValue;
    }
});

// Save style preference
elements.styleSelect.addEventListener('change', () => {
    browser.storage.local.set({ style: elements.styleSelect.value });
});

// Enhance button handler
elements.enhanceBtn.addEventListener('click', async () => {
    const text = elements.inputText.value.trim();
    if (!text) return showError("Please enter some text first.");

    setLoading(true);
    hideError();

    try {
        // Step 1: Get History from Content Script
        let history = [];
        try {
            const tabs = await browser.tabs.query({ active: true, currentWindow: true });
            if (tabs.length > 0) {
                // Send message to content script
                const historyResponse = await browser.tabs.sendMessage(tabs[0].id, { type: "getHistory" });
                if (historyResponse && historyResponse.history) {
                    history = historyResponse.history;
                }
            }
        } catch (e) {
            console.warn("Could not fetch history:", e);
        }

        // Get saved model preference
        const data = await browser.storage.local.get("model");
        const modelId = data.model;

        // Step 2: Send to Background for Enhancement
        const response = await browser.runtime.sendMessage({
            type: "enhanceText",
            text: text,
            style: elements.styleSelect.value,
            history: history,
            model: modelId // Pass the retrieved model
        });

        if (response.success) {
            elements.outputText.textContent = response.result;
            elements.outputSection.classList.remove('hidden');
        } else {
            showError(response.error || "Enhancement failed. Check API key.");
        }
    } catch (err) {
        showError("Communication error: " + err.message);
    } finally {
        setLoading(false);
    }
});

// Suggestion button handler
elements.suggestBtn.addEventListener('click', async () => {
    elements.suggestionChips.innerHTML = '<span class="placeholder-text">Thinking...</span>';

    try {
        // Step 1: Get History (Vital for suggestions)
        let history = [];
        try {
            const tabs = await browser.tabs.query({ active: true, currentWindow: true });
            if (tabs.length > 0) {
                const historyResponse = await browser.tabs.sendMessage(tabs[0].id, { type: "getHistory" });
                if (historyResponse?.history) history = historyResponse.history;
            }
        } catch (e) {
            console.warn("History fetch failed:", e);
        }

        if (history.length === 0) {
            elements.suggestionChips.innerHTML = '<span class="placeholder-text">No history found. Start chatting first!</span>';
            return;
        }

        const data = await browser.storage.local.get("model");

        // Step 2: Call API
        const response = await browser.runtime.sendMessage({
            type: "suggestNext",
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
    }
});

function renderSuggestions(text) {
    elements.suggestionChips.innerHTML = '';

    // Parse the list (Expect: "1. Idea one\n2. Idea two...")
    const lines = text.split(/\n/);
    const suggestions = lines.filter(l => l.match(/^\d+\./) || l.trim().startsWith('-')).slice(0, 3);

    if (suggestions.length === 0) {
        // Fallback if parsing fails, just show raw text if short
        const chip = createChip(text.substring(0, 100) + "...");
        elements.suggestionChips.appendChild(chip);
        return;
    }

    suggestions.forEach(line => {
        // Clean "1. " prefix
        const cleanText = line.replace(/^\d+\.|^-\s*/, '').trim();
        const chip = createChip(cleanText);
        elements.suggestionChips.appendChild(chip);
    });
}

function createChip(text) {
    const chip = document.createElement('div');
    chip.className = 'suggestion-chip';
    chip.textContent = text;
    chip.title = "Click to use";
    chip.onclick = () => {
        elements.inputText.value = text;
        // Optional: Auto-focus or auto-enhance? Let's just fill for now.
    };
    return chip;
}

// Apply button handler - sends text to content script
elements.applyBtn.addEventListener('click', async () => {
    const text = elements.outputText.textContent;

    // Get active tab and send message
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
        browser.tabs.sendMessage(tabs[0].id, {
            type: "applyText",
            text: text
        });
    }
});

// Copy button handler
elements.copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(elements.outputText.textContent);
    const originalText = elements.copyBtn.textContent;
    elements.copyBtn.textContent = "✅";
    setTimeout(() => elements.copyBtn.textContent = originalText, 2000);
});

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
