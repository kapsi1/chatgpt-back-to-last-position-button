# ChatGPT "Back to Last Position" Button

A browser extension for Chrome and Opera that remembers your scroll position in ChatGPT conversations and allows you to jump back to it after an auto-scroll occurs (e.g., when sending a message).

## Features

- **Automatic Position Saving**: Automatically saves your current scroll position when you send a message.
- **Smart Jump Back**: Shows a stylish "up arrow" button if ChatGPT auto-scrolls you away from your reading position.
- **Seamless Integration**: Designed to match ChatGPT's native UI, including support for both Light and Dark themes.
- **Smooth Animation**: Smoothly scrolls back to your saved position with a single click.
- **SPA Aware**: Works correctly across different conversations without page refreshes.

## Installation

### From Source (Development)

1. Clone this repository.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Build the extension:
   ```bash
   pnpm run build
   ```
4. Load the extension in your browser:
   - **Chrome**: Go to `chrome://extensions/`, enable "Developer mode", click "Load unpacked", and select the `dist` folder.
   - **Opera**: Go to `opera://extensions`, enable "Developer mode", click "Load unpacked", and select the `dist` folder.

### Development Mode

To run with Hot Module Replacement (HMR) during development:
```bash
pnpm run dev
```

## How It Works

1. **Watch for Submission**: The extension listens for Enter keypresses or Send button clicks.
2. **Save State**: If you're not already at the bottom of the chat, your current scroll position is stored.
3. **Show Button**: Once ChatGPT auto-scrolls to display a new response, if you were reading something above, a jump-back button appears at the top.
4. **Restore**: Clicking the button takes you back to exactly where you were.

## Tech Stack

- **TypeScript**: For robust, type-safe code.
- **Vite & CRXJS**: Modern build toolchain for Chrome Extensions.
- **Vanilla CSS**: Optimized, high-performance styling using CSS variables.
- **MutationObserver**: For handling ChatGPT's dynamic Single Page Application (SPA) DOM.

---

*Note: This extension is not affiliated with, maintained, authorized, endorsed, or sponsored by OpenAI.*
