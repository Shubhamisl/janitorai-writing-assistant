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
    return `write the next message

look at the last few messages closely. what just happened? what tension or momentum exists? write a reply that:
- directly responds to or builds on what the other character just said/did
- moves the scene forward with a new action, question, revelation, or emotional beat
- feels natural to your character's voice, not generic
- aim for 4-8 sentences, a solid medium-length reply
- uses markdown naturally (italics for actions/internal thoughts)
- gives the other character something compelling to react to

output ONLY the raw message text. no quotes, no labels, no narrator tags, no meta commentary, no lead-in like 'here is'`;
}

/**
 * Generates the message array for text enhancement based on the selected style
 * @param {string} style - The writing style (novel, casual, roleplay)
 * @param {Array} history - Chat history
 * @param {string} scenario - Optional scenario placeholder
 * @param {string} exampleDialogs - Optional example dialogs placeholder
 * @param {string} summary - Optional summary placeholder
 * @param {string} draft - The draft text to rewrite
 * @returns {Array} The formatted messages array
 */
export function getEnhanceMessages(style, history = [], draft = "", scenario = DEFAULT_SCENARIO, exampleDialogs = DEFAULT_EXAMPLE_DIALOGS, summary = DEFAULT_SUMMARY) {
    const messages = [];

    messages.push({
        role: "system",
        content: buildSystemContent(scenario, exampleDialogs, summary)
    });

    const historyMessages = convertHistoryToMessages(history);
    messages.push(...historyMessages);

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
    const messages = [];

    messages.push({
        role: "system",
        content: buildSystemContent(scenario, exampleDialogs, summary)
    });

    const historyMessages = convertHistoryToMessages(history);
    messages.push(...historyMessages);

    messages.push({
        role: "user",
        content: getSuggestTaskPrompt()
    });

    return messages;
}


