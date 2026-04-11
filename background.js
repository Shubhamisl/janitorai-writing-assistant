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

  const historyText = history.map(h => `${h.role === 'user' ? 'User' : 'Character'}: ${h.content}`).join('\n');
  const prompt = `You are a creative co-pilot. Based on the history, suggest 3 DISTINCT directions for the USER'S next response.
    
History:
${historyText}

Output strictly 3 lines, numbered 1-3.
Example:
1. [Aggressive] Draw your sword and demand answers.
2. [Diplomatic] Try to negotiate a truce.
3. [Flirty] Compliment their eyes.`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${data.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://janitorai.com",
      "X-Title": "JanitorAI Writing Assistant"
    },
    body: JSON.stringify({
      model: model || "anthropic/claude-3.5-sonnet",
      messages: [{ role: "system", content: prompt }]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API Error: ${response.status}`);
  }

  const result = await response.json();
  return result.choices[0].message.content;
}

async function handleEnhancement(text, model, style, history = []) {
  try {
    const data = await browser.storage.local.get("apiKey");
    const apiKey = data.apiKey;

    if (!apiKey) {
      throw new Error("API Key not found. Please set it in the extension settings.");
    }

    let systemPrompt = getSystemPrompt(style);

    // Append History to System Prompt if available
    if (history.length > 0) {
      const historyText = history.map(h => `${h.role === 'user' ? 'User' : 'Character'}: ${h.content}`).join('\n');
      systemPrompt += `\n\n[CONTEXT - RECENT CONVERSATION]\nThe following is the recent conversation history. Use it to inform the tone, plot, and character voice.\n\n${historyText}\n\n[END CONTEXT]`;
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://janitorai.com", // Optional, for OpenRouter rankings
        "X-Title": "JanitorAI Writing Assistant"
      },
      body: JSON.stringify({
        model: model || "anthropic/claude-3.5-sonnet", // Default model
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `API Error: ${response.status}`);
    }

    const result = await response.json();
    return result.choices[0].message.content;

  } catch (err) {
    console.error("Enhancement failed:", err);
    throw err;
  }
}

function getSystemPrompt(style) {
  switch (style) {
    case "novel":
      return `TASK: GHOSTWRITE/REWRITE the user's draft.
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

    case "casual":
      return `TASK: POLISH this chat message.
ROLE: You are a text polisher.
INPUT: A rough chat message.
OUTPUT: The same message, phrased more naturally.

Guidelines:
1. **Constraint**: Do NOT reply. Just rewrite the draft.
2. **Tone**: Relaxed, fluid, authentic.
3. **Clarity**: Fix awkward phrasing.
Output ONLY the enhanced text.`;

    case "roleplay":
    default:
      return `TASK: GHOSTWRITE/REWRITE the user's roleplay turn.
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
  }
}
