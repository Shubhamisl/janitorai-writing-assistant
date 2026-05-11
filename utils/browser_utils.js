// Browser-specific utility functions
const browser = globalThis.browser ?? globalThis.chrome;

/**
 * Gets the active tab in the current window if it's a JanitorAI tab.
 * @returns {Promise<chrome.tabs.Tab|null>}
 */
export async function getActiveJanitorTab() {
    try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        if (!tab || !tab.url) return null;

        const url = new URL(tab.url);
        if (url.hostname === 'janitorai.com' || url.hostname.endsWith('.janitorai.com')) {
            return tab;
        }
        return null;
    } catch (err) {
        console.error('Error getting active tab:', err);
        return null;
    }
}
