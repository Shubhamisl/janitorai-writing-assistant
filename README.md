# JanitorAI Writing Assistant

A Firefox/Chrome/Edge extension that enhances your writing experience on JanitorAI with AI-powered text enhancement and smart suggestions.

## Features

- **AI Text Enhancement**: Rewrite and polish your drafts using OpenRouter API
- **Smart Suggestions**: Get 3 context-aware plot direction ideas
- **Multiple Styles**: Choose between Roleplay, Novel, or Casual writing modes
- **Context Awareness**: Automatically scrapes chat history for better AI responses
- **React-Compatible**: Works seamlessly with JanitorAI's React-based interface
- **Privacy Focused**: API key stored locally, no data leaves your browser except to OpenRouter

## How It Works

1. The extension adds a sidebar to JanitorAI chats
2. When you type text and click "Enhance Text", it:
   - Scrapes recent chat history for context
   - Sends your draft and context to OpenRouter AI with style-specific prompts
   - Returns enhanced text for you to review
   - Lets you insert the enhanced text directly into the chat box
3. Smart suggestions work similarly, generating 3 distinct plot directions based on conversation history

## Installation

### Firefox / Zen Browser

1. Download or clone this repository
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click **"Load Temporary Add-on..."**
4. Select the `manifest.json` file from the extension directory
5. The extension will appear in your browser toolbar

### Chrome / Edge

1. Download or clone this repository
2. Open Chrome/Edge and navigate to `chrome://extensions`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked"
5. Select the extension directory
6. The extension will appear in your browser toolbar

## Configuration

1. Click the extension icon in your browser toolbar
2. Enter your **OpenRouter API Key** (get one at [openrouter.ai](https://openrouter.ai))
3. (Optional) Specify a custom model ID (default: `anthropic/claude-3.5-sonnet`)
4. Click **Save Settings**
5. The extension saves your settings locally in your browser's storage

> 💡 **Tip**: Your API key never leaves your browser and is only used to make requests to OpenRouter on your behalf.

## Usage

1. Navigate to any chat on [janitorai.com](https://janitorai.com)
2. Open the sidebar (click extension icon or use keyboard shortcut)
3. **To Enhance Text:**
   - Type your rough draft in the sidebar input
   - Select a writing style (Roleplay, Novel, or Casual)
   - Click "Enhance Text"
   - Review the AI-generated output
   - Click "Insert to Chat" to add it to the JanitorAI input box
4. **To Get Suggestions:**
   - Click the lightbulb icon (💡)
   - Review the 3 suggested plot directions
   - Click a suggestion chip to use it as your draft

## Project Structure

```
.
├── manifest.json         # Extension configuration with permissions for storage, activeTab, scripting, and sidePanel functionality
├── background.js         # Handles API calls to OpenRouter, manages settings, and processes messages
├── content.js            # Detects chat interface, receives messages from sidebar, extracts chat history, and inserts text into JanitorAI's textarea
├── sidebar/
│   ├── sidebar.html      # Main sidebar UI
│   ├── sidebar.css       # Sidebar styles
│   └── sidebar.js        # Sidebar logic and event handling
└── utils/
    ├── prompts.js        # Generates system prompts for text enhancement and suggestion generation based on selected style and chat history
    ├── api.js            # Handles API calls to OpenRouter with timeout management
    └── scraping.js       # Contains selectors and functions for finding chat elements and extracting history from JanitorAI's React-based interface
```

## Development

### Requirements
- Firefox Developer Edition (recommended) or Zen Browser
- OpenRouter API key

### Running Locally
1. Clone this repository
2. Load as temporary extension (see Installation above)
3. Make changes to the code
4. Click "Reload" in `about:debugging` to test changes

## Privacy

- Your OpenRouter API key is stored locally in your browser
- Chat history is scraped client-side and never sent to external servers (except as context to your OpenRouter API calls)
- No telemetry or tracking

## License

MIT License - See LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues or feature requests, please open an issue on GitHub.
