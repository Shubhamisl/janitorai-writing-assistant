// Reusable logic for making API calls to OpenRouter

const API_TIMEOUT = 60000; // 60 seconds

/**
 * Shared helper for making API calls to OpenRouter
 * @param {Array} messages - Array of message objects
 * @param {string} model - e.g. "anthropic/claude-3.5-sonnet"
 * @param {string} apiKey 
 * @returns {Promise<string>} The result string
 */
async function callOpenRouterAPI(messages, model, apiKey) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://janitorai.com",
                "X-Title": "JanitorAI Writing Assistant"
            },
            body: JSON.stringify({
                model: model || "anthropic/claude-3.5-sonnet",
                messages: messages
            }),
            signal: controller.signal
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API Error ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        return result.choices[0].message.content;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Request timed out after 60 seconds');
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Make an API call to OpenRouter
 * @param {string} prompt - Input prompt or instruction text
 * @param {string} model - e.g. "anthropic/claude-3.5-sonnet"
 * @param {string} apiKey
 * @returns {Promise<string>} The result string
 */
export async function generateText(prompt, model, apiKey) {
    return callOpenRouterAPI([{ role: "system", content: prompt }], model, apiKey);
}

/**
 * Special generator that accepts system prompt and user input
 * @param {string} systemPrompt - Instruction defining the AI behavior/style
 * @param {string} userText - The text to be enhanced
 * @param {string} model - e.g. "anthropic/claude-3.5-sonnet"
 * @param {string} apiKey
 * @returns {Promise<string>} The result string
 */
export async function enhanceTextCompletion(systemPrompt, userText, model, apiKey) {
    return callOpenRouterAPI([
        { role: "system", content: systemPrompt },
        { role: "user", content: userText }
    ], model, apiKey);
}
