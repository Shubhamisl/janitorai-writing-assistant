/**
 * Prompts utility for JanitorAI Writing Assistant
 */

/**
 * Formats the chat history into a readable string
 * @param {Array} history - Chat history array
 * @returns {string} Formatted history string
 */
function formatHistory(history) {
    return history.map(h => `${h.role === 'user' ? 'User' : 'Character'}: ${h.content}`).join('\n');
}

/**
 * Generates the system prompt for text enhancement based on the selected style
 * @param {string} style - The writing style (novel, casual, roleplay)
 * @param {Array} history - Optional chat history to include in context
 * @returns {string} The formatted system prompt
 */
export function getEnhanceSystemPrompt(style, history = []) {
    let basePrompt = "";

    switch (style) {
        case "novel":
            basePrompt = `TASK: GHOSTWRITE/REWRITE the user's draft.
ROLE: You are an expert co-writer for the User.
INPUT: A draft snippet OR an instruction from the User's perspective.
OUTPUT: The SAME actions/dialogue, rewritten into rich, First-Person ("I") prose.

Guidelines:
1. **Perspective**: STRICTLY First Person ("I", "me"). Do NOT switch to the other character's POV.
2. **Constraint**: Do NOT reply to the text. Do NOT generate the other character's reaction. Only rewrite what the User wrote.
3. **Instructions**: If the input is a command (e.g., "Ask her about the key"), write the narration of the User asking (e.g., "I turned to her. 'Tell me about the key,' I pressed.").
4. **Show, Don't Tell**: Use sensory details to ground the scene.
5. **Tone**: Sophisticated, evocative.
6. **Context**: Use the provided history to understand the scene, but do not write *for* the history.
Output ONLY the enhanced text.`;
            break;

        case "casual":
            basePrompt = `TASK: POLISH this chat message.
ROLE: You are a text polisher.
INPUT: A rough chat message.
OUTPUT: The same message, phrased more naturally.

Guidelines:
1. **Constraint**: Do NOT reply. Just rewrite the draft.
2. **Tone**: Relaxed, fluid, authentic.
3. **Clarity**: Fix awkward phrasing.
Output ONLY the enhanced text.`;
            break;

        case "roleplay":
        default:
            basePrompt = `TASK: GHOSTWRITE/REWRITE the user's roleplay turn.
ROLE: You are the User's writing assistant.
INPUT: A rough draft OR an instruction from the User.
OUTPUT: The SAME actions/dialogue, rewritten to be immersive and formatted correctly.

Guidelines:
1. **Constraint**: Do NOT reply. Do NOT write the other character's dialogue/actions. STOP writing after the User's turn.
2. **Instructions**: If the input is an instruction (e.g., "Kiss him", "Ask about the map"), write the generic description or dialogue for that action (e.g., *I leaned in and kissed him.* or "Where is the map?").
3. **Formatting**: 
   - ACTIONS must be inside *asterisks* (e.g., *She sighed.*).
   - DIALOGUE must be inside "double quotes" (e.g., "Hello.").
   - Do NOT combine them (e.g., *She said "Hello"* is WRONG).
   - Correct: *She looked up.* "Hello," she said.
4. **Expansion**: Expand emotional cues and sensory details.
5. **Perspective**: Maintain the User's POV (usually Third Person Limited for the User's character, or First Person depending on style).
Output ONLY the enhanced response.`;
            break;
    }

    // Append History to System Prompt if available
    if (history.length > 0) {
        const historyText = formatHistory(history);
        basePrompt += `\n\n[CONTEXT - RECENT CONVERSATION]\nThe following is the recent conversation history. Use it to inform the tone, plot, and character voice.\n\n${historyText}\n\n[END CONTEXT]`;
    }

    return basePrompt;
}

/**
 * Generates the prompt for suggesting next actions
 * @param {Array} history - Chat history
 * @returns {string} The formatted prompt
 */
export function getSuggestionPrompt(history) {
    const historyText = formatHistory(history);
    return `You are a creative co-pilot. Based on the history, suggest 3 DISTINCT directions for the USER'S next response.
    
History:
${historyText}

Output strictly 3 lines, numbered 1-3.
Example:
1. [Aggressive] Draw your sword and demand answers.
2. [Diplomatic] Try to negotiate a truce.
3. [Flirty] Compliment their eyes.`;
}
