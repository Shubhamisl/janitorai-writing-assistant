// Reusable scraping logic for content scripts

export const SELECTORS = {
    // The main chat textarea
    chatInput: [
        'textarea[class*="_chatTextarea_"]',
        'textarea[placeholder*="Enter to send"]',
        'textarea' // last-resort fallback
    ],

    // Each rendered message (both user and character)
    messageItem: 'li[class*="_messageDisplayWrapper_"]',

    // The speaker name inside a message
    nameText: 'div[class*="_nameText_"]',

    // Present ONLY in character (AI) messages -- used for role detection
    characterIcon: 'img[alt="Character Icon"]',

    // The message body wrapper that contains the paragraph text
    messageBody: 'div[class*="_messageBody_"]'
};

export function findChatInput() {
    for (const selector of SELECTORS.chatInput) {
        const el = document.querySelector(selector);
        if (el) return el;
    }
    return null;
}

export function getChatHistory(limit = 10) {
    const history = [];

    const messageItems = document.querySelectorAll(SELECTORS.messageItem);
    // Take the most recent `limit` messages (virtual list renders in order)
    const recent = Array.from(messageItems).slice(-limit);

    for (const msgEl of recent) {
        const bodyEl = msgEl.querySelector(SELECTORS.messageBody);
        if (!bodyEl) continue;

        // Role: character messages carry the JanitorAI logo icon next to the
        // speaker name. User messages have no such icon.
        const isCharacter = Boolean(msgEl.querySelector(SELECTORS.characterIcon));
        const role = isCharacter ? 'model' : 'user';

        // Collect the text from all <p> tags inside the message body.
        const paragraphs = bodyEl.querySelectorAll('p');
        const content = Array.from(paragraphs)
            .map(p => p.innerText.trim())
            .filter(Boolean)
            .join('\n')
            .trim();

        if (content) {
            history.push({ role, content });
        }
    }

    return history;
}

// React-compatible textarea value setter
export function setNativeValue(textarea, value) {
    const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype, 'value'
    ).set;
    setter.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

export function insertText(text) {
    const input = findChatInput();
    if (!input) {
        console.warn("JanitorAI Writing Assistant: chat textarea not found");
        return;
    }

    input.focus();

    // Prefer execCommand for contenteditable-based editors
    const success = document.execCommand('insertText', false, text);

    // Fall back to the React-compatible setter when execCommand does nothing.
    if (!success || input.value === '') {
        setNativeValue(input, text);
    }
}
