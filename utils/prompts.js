/**
 * Prompts utility for JanitorAI Writing Assistant
 */

const DEFAULT_SCENARIO = "Placeholder Scenario";
const DEFAULT_EXAMPLE_DIALOGS = "Placeholder Example Dialogs";
const DEFAULT_SUMMARY = "Placeholder Summary";

function buildSystemContent(scenario = DEFAULT_SCENARIO, exampleDialogs = DEFAULT_EXAMPLE_DIALOGS, summary = DEFAULT_SUMMARY) {
    return `<Scenario>${scenario}</Scenario>\n<example_dialogs>${exampleDialogs}</example_dialogs>\n<summary>${summary}</summary>`;
}

function convertHistoryToMessages(history) {
    return history.map(h => ({
        role: h.role,
        content: h.content
    }));
}

function buildBaseMessages(history, scenario, exampleDialogs, summary) {
    const messages = [];

    messages.push({
        role: "system",
        content: buildSystemContent(scenario, exampleDialogs, summary)
    });

    const historyMessages = convertHistoryToMessages(history);
    messages.push(...historyMessages);

    return messages;
}

function getEnhanceTaskPrompt(style, draft) {
    switch (style) {
        case "novel":
            return `rewrite this draft: ${draft}

goals
- rewrite in rich, first-person prose
- preserve the same actions and dialogue, just enhance quality
- use sensory details to ground the scene
- maintain your character's voice and perspective
- use markdown formatting naturally (italics for actions/thoughts)
- expand to 4-8 sentences if the draft is short, otherwise keep similar length

output ONLY the raw message text. no quotes, no labels, no narrator tags, no meta commentary, no lead-in like 'here is'`;
        case "casual":
            return `polish this message: ${draft}

goals
- rewrite to sound more natural and fluid
- fix any awkward phrasing
- keep the same meaning and intent
- maintain a casual, relaxed tone

output ONLY the raw message text. no quotes, no labels, no narrator tags, no meta commentary, no lead-in like 'here is'`;
        case "roleplay":
        default:
            return `rewrite this draft: ${draft}

goals
- punch up the language, make it vivid and grounded in the scene
- keep your voice and mannerisms authentic
- react to what the other character just said or did, dont ignore it
- push the interaction forward, give the other character something to respond to
- use markdown formatting naturally (italics for actions/thoughts)
- expand to 4-8 sentences if the draft is short, otherwise keep similar length

output ONLY the raw message text. no quotes, no labels, no narrator tags, no meta commentary, no lead-in like 'here is'`;
    }
}

function getSuggestTaskPrompt() {
    return `You are a creative co-pilot. Based on the conversation history, suggest 3 DISTINCT directions for the USER'S next response.

goals:
- move the scene forward (new action, dialogue, or emotional beat)
- keep suggestions concise (1-2 sentences each)
- aim for variety: one action-oriented, one emotional/internal, and one character-specific
- use markdown naturally (italics for actions)

output strictly 3 lines, numbered 1-3. no meta commentary, no labels like 'Action:' or 'Emotional:', just the content of the suggestion.`;
}

/**
 * Generates the message array for text enhancement based on the selected style
 * @param {string} style - The writing style (novel, casual, roleplay)
 * @param {string} draft - The draft text to rewrite
 * @param {Array} history - Chat history
 * @param {string} scenario - Optional scenario placeholder
 * @param {string} exampleDialogs - Optional example dialogs placeholder
 * @param {string} summary - Optional summary placeholder
 * @returns {Array} The formatted messages array
 */
export function getEnhanceMessages(style, history = [], draft = "", scenario = DEFAULT_SCENARIO, exampleDialogs = DEFAULT_EXAMPLE_DIALOGS, summary = DEFAULT_SUMMARY) {
    const messages = buildBaseMessages(history, scenario, exampleDialogs, summary);

    messages.push({
        role: "user",
        content: getEnhanceTaskPrompt(style, draft)
    });

    return messages;
}

/**
 * Generates the message array for suggesting next actions
 * @param {Array} history - Chat history
 * @param {string} scenario - Optional scenario placeholder
 * @param {string} exampleDialogs - Optional example dialogs placeholder
 * @param {string} summary - Optional summary placeholder
 * @returns {Array} The formatted messages array
 */
export function getSuggestMessages(history, scenario = DEFAULT_SCENARIO, exampleDialogs = DEFAULT_EXAMPLE_DIALOGS, summary = DEFAULT_SUMMARY) {
    const messages = buildBaseMessages(history, scenario, exampleDialogs, summary);

    messages.push({
        role: "user",
        content: getSuggestTaskPrompt()
    });

    return messages;
}
