// Content script for detecting chat interface

console.log("JanitorAI Writing Assistant: Content script loaded");

// Configuration
const CONFIG = {
    chatInputSelectors: [
        'textarea[placeholder*="message"]',
        'textarea[class*="input"]',
        'textarea' // Fallback
    ]
};

// React-compatible value setter
function setNativeValue(element, value) {
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value').set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value').set;

    if (valueSetter && valueSetter !== prototypeValueSetter) {
        prototypeValueSetter.call(element, value);
    } else {
        valueSetter.call(element, value);
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
}

// Function to find the chat input
function findChatInput() {
    for (const selector of CONFIG.chatInputSelectors) {
        const element = document.querySelector(selector);
        if (element) return element;
    }
    return null;
}

// Observer to detect when chat interface loads
const observer = new MutationObserver((mutations) => {
    const chatInput = findChatInput();
    if (chatInput && !chatInput.dataset.writerConnected) {
        console.log("JanitorAI Writing Assistant: Chat input detected");
        chatInput.dataset.writerConnected = "true";

        // Listen for events from the sidebar (via background or direct custom events if we go that route)
        // For now, we'll setup a listener for a custom event that the sidebar could dispatch if it were injected
        // OR we just wait for the user to paste/apply.

        // Since sidebar is separate context in Firefox, we might need a runtime listener here 
        // to receive "Apply" commands from the sidebar script.

        // Listen for events from the sidebar
        browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === "applyText") {
                insertText(chatInput, message.text);
            } else if (message.type === "getHistory") {
                const history = getChatHistory();
                sendResponse({ history: history });
            }
        });
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

function insertText(inputElement, text) {
    if (!inputElement) return;
    inputElement.focus();

    // Strategy 1: document.execCommand (Best for ContentEditable/Rich Text)
    // JanitorAI might use a rich text editor or a complex textarea.
    const success = document.execCommand('insertText', false, text);

    // Strategy 2: If execCommand failed (or didn't work as expected on a standard textarea), 
    // force React value setter.
    if (!success || inputElement.value === "") {
        const currentVal = inputElement.value;
        // Append if there's existing text and we didn't just replace it via execCommand
        const newValue = currentVal ? currentVal + " " + text : text;
        setNativeValue(inputElement, newValue);
    }
}

// Heuristic Chat History Scraper
function getChatHistory() {
    const history = [];

    // Strategy: Find all message containers. 
    // JanitorAI usually has message blocks. We look for containers with significant text.
    // We'll look for elements that look like message bubbles.

    // Generic selector for message-like divs (often have distinct classes in React apps)
    // We'll look for any div that contains text and is inside the main scrollable area.
    // Best guess for JanitorAI's structure:

    // Try to find the main chat container first
    const mainContainer = document.querySelector('div[class*="chat-msgs"]') || document.body;

    // If we can't find a specific container, fall back to searching all divs with text
    // This is a "blind" heuristic but robust against minor class name changes
    const candidates = mainContainer.querySelectorAll('div[class*="msg"], div[class*="message"], div[class*="Message"], div[class*="bubble"]');

    // Filter for elements that actually have text and aren't hidden
    const messages = Array.from(candidates).filter(el => {
        return el.innerText.length > 5 && el.offsetParent !== null;
    });

    // Take the last 10 messages
    const recentMessages = messages.slice(-10);

    recentMessages.forEach(msgEl => {
        // Determine role based on alignment or class
        // Heuristic: User messages often have specific classes or alignment
        // We'll assume "model" by default unless we find "user" indicators
        let role = "model";

        // Check for "User" or "You" labels, or right-alignment classes
        const textContent = msgEl.innerText;
        const className = msgEl.className.toLowerCase();
        const isUser = className.includes("user") ||
            className.includes("mine") ||
            className.includes("right") ||
            msgEl.style.justifyContent === "flex-end" ||
            msgEl.style.alignSelf === "flex-end";

        if (isUser) role = "user";

        // Basic cleaning
        const cleanContent = textContent.replace(/\n+/g, ' ').trim();

        if (cleanContent) {
            history.push({ role, content: cleanContent });
        }
    });

    return history;
}
