// Content script for detecting chat interface
const browser = globalThis.browser ?? globalThis.chrome;

console.log("JanitorAI Writing Assistant: Content script loaded");

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
