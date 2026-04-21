// Content script for detecting chat interface
const browser = globalThis.browser ?? globalThis.chrome;

console.log("JanitorAI Writing Assistant: Content script loaded");

// ---------------------------------------------------------------------------
// Single top-level message listener. A window flag prevents double-registration
// when the sidebar injects this script into a tab where it already ran via
// the manifest's content_scripts declaration.
// ---------------------------------------------------------------------------
if (!window._writerListenerRegistered) {
    window._writerListenerRegistered = true;
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
}

// ---------------------------------------------------------------------------
// MutationObserver: watch for the chat textarea appearing so we can mark it
// and log confirmation. Once found, we disconnect the observer to save CPU.
// ---------------------------------------------------------------------------
function markChatInput() {
    const chatInput = findChatInput();
    if (chatInput && !chatInput.dataset.writerConnected) {
        console.log("JanitorAI Writing Assistant: Chat textarea detected");
        chatInput.dataset.writerConnected = 'true';
        return true;
    }
    return false;
}

// Check immediately, then fallback to observer if not yet present
if (!markChatInput()) {
    let timeoutId;
    const observer = new MutationObserver((mutations, obs) => {
        // Performance: only scan if nodes were actually added
        const hasAddedNodes = mutations.some(m => m.addedNodes.length > 0);
        if (hasAddedNodes && markChatInput()) {
            if (timeoutId) clearTimeout(timeoutId);
            obs.disconnect();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // One last check after starting observation to handle race conditions
    if (markChatInput()) {
        observer.disconnect();
    } else {
        // Safety timeout: stop watching if not found after 15s
        timeoutId = setTimeout(() => {
            observer.disconnect();
            console.warn("JanitorAI Writing Assistant: Chat textarea detection timed out (15s)");
        }, 15000);
    }
}
