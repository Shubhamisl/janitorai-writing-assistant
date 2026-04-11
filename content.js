// Content script for detecting chat interface
const browser = globalThis.browser ?? globalThis.chrome;

console.log("JanitorAI Writing Assistant: Content script loaded");

// ---------------------------------------------------------------------------
// Selectors derived from JanitorAI's actual DOM structure.
// The class names are CSS-module hashes (e.g. "_chatTextarea_1e2lg_1") that
// may change between deploys, so we match only on the stable prefix using
// the [class*="..."] attribute selector.
// ---------------------------------------------------------------------------

const SELECTORS = {
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

// ---------------------------------------------------------------------------
// React-compatible textarea value setter.
// We must trigger React's synthetic onChange so the framework picks up the
// new value. We call the prototype setter (not the instance one) to bypass
// React's own descriptor and then fire a real "input" event.
// ---------------------------------------------------------------------------
function setNativeValue(textarea, value) {
    const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype, 'value'
    ).set;
    setter.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

// ---------------------------------------------------------------------------
// Find the current chat textarea (it may be re-mounted by React at any time)
// ---------------------------------------------------------------------------
function findChatInput() {
    for (const selector of SELECTORS.chatInput) {
        const el = document.querySelector(selector);
        if (el) return el;
    }
    return null;
}

// ---------------------------------------------------------------------------
// Insert text into the chat textarea.
// We always set the full value (replacing any existing draft) so the output
// from the assistant is placed cleanly, as if the user had typed it.
// ---------------------------------------------------------------------------
function insertText(text) {
    const input = findChatInput();
    if (!input) {
        console.warn("JanitorAI Writing Assistant: chat textarea not found");
        return;
    }

    input.focus();

    // Prefer execCommand for contenteditable-based editors; on a plain
    // <textarea> this replaces the current selection (or all text if none).
    const success = document.execCommand('insertText', false, text);

    // Fall back to the React-compatible setter when execCommand does nothing.
    if (!success || input.value === '') {
        setNativeValue(input, text);
    }
}

// ---------------------------------------------------------------------------
// Chat history scraper -- reads the last N messages from the virtual list.
//
// Structure (from temp.html inspection):
//   li[class*="_messageDisplayWrapper_"]
//     div[class*="_messageBody_"]
//       div[class*="_nameText_"]          <-- speaker name
//       img[alt="Character Icon"]         <-- ONLY present for AI messages
//       p                                 <-- message text (may be multiple)
// ---------------------------------------------------------------------------
function getChatHistory(limit = 10) {
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
        // A single message can span multiple paragraphs.
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

// ---------------------------------------------------------------------------
// Single top-level message listener (avoids accumulation if the textarea is
// re-mounted by React). The listener is always registered once, and locates
// the current textarea at the time of handling.
// ---------------------------------------------------------------------------
browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    console.log(`JanitorAI Writing Assistant: Content script processing message type [${message.type}]`);
    if (message.type === 'applyText') {
        insertText(message.text);
        // No async response needed
    } else if (message.type === 'getHistory') {
        const history = getChatHistory();
        console.log(`JanitorAI Writing Assistant: Extracted ${history.length} messages from history.`);
        sendResponse({ history });
    } else {
        console.warn(`JanitorAI Writing Assistant: Received unexpected message type [${message.type}]`);
    }
});

// ---------------------------------------------------------------------------
// MutationObserver: watch for the chat textarea appearing so we can mark it
// and log confirmation. Actual message handling no longer depends on this.
// ---------------------------------------------------------------------------
const observer = new MutationObserver(() => {
    const chatInput = findChatInput();
    if (chatInput && !chatInput.dataset.writerConnected) {
        console.log("JanitorAI Writing Assistant: Chat textarea detected");
        chatInput.dataset.writerConnected = 'true';
    }
});

observer.observe(document.body, { childList: true, subtree: true });
