import { callAPI } from './utils/api.js';
import { getEnhanceMessages, getSuggestMessages } from './utils/prompts.js';

// Background script for handling API calls and state
const browser = globalThis.browser ?? globalThis.chrome;

// Edge/Chrome: Open side panel on icon click
if (typeof chrome !== "undefined" && chrome.sidePanel) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
} else if (typeof browser !== "undefined" && browser.sidebarAction && browser.sidebarAction.toggle) {
  // Firefox: Toggle sidebar on icon click
  browser.action.onClicked.addListener(() => {
    browser.sidebarAction.toggle().catch(console.error);
  });
}

// Listener for messages from content scripts or sidebar
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(`JanitorAI Writing Assistant: Background script processing message type [${message.type}]`);
  if (message.type === "enhanceText") {
    handleEnhancement(message.text, message.model, message.style, message.history)
      .then(response => {
        console.log(`JanitorAI Writing Assistant: Enhancement successful.`);
        sendResponse({ success: true, result: response });
      })
      .catch(error => {
        console.error(`JanitorAI Writing Assistant: Enhancement failed. Error: ${error.message}`);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.type === "suggestNext") {
    handleSuggestion(message.history, message.model)
      .then(response => {
        console.log(`JanitorAI Writing Assistant: Suggestion successful.`);
        sendResponse({ success: true, result: response });
      })
      .catch(error => {
        console.error(`JanitorAI Writing Assistant: Suggestion failed. Error: ${error.message}`);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

async function handleSuggestion(history, model) {
  const data = await browser.storage.local.get("apiKey");
  if (!data.apiKey) throw new Error("API Key missing");

  const messages = getSuggestMessages(history);

  return callAPI(messages, model, data.apiKey);
}

async function handleEnhancement(text, model, style, history = []) {
  try {
    const data = await browser.storage.local.get("apiKey");
    const apiKey = data.apiKey;

    if (!apiKey) {
      throw new Error("API Key not found. Please set it in the extension settings.");
    }

    const messages = getEnhanceMessages(style, history, text);

    return callAPI(messages, model, apiKey);

  } catch (err) {
    console.error("Enhancement failed:", err);
    throw err;
  }
}
