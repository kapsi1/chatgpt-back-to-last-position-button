# ChatGPT "Back to Last Position" Button — Browser Extension

> A Chrome/Opera browser extension that remembers your scroll position in ChatGPT conversations and lets you jump back to it with a single click.

---

## Overview

When a user sends a message on ChatGPT, the chat auto-scrolls to the bottom to show the streaming response. This extension saves the scroll position right before that auto-scroll happens, then injects an **"up arrow" button** at the **top** of the chat container (mirroring the style of ChatGPT's native "scroll to bottom" down-arrow button). Clicking it smoothly scrolls back to where the user was reading.

---

## Tasks

### 1. Project Scaffolding

- [x] **1.1 Initialize the project with pnpm and Vite**
  - Run `pnpm init` to create `package.json`.
  - Install Vite, TypeScript, and `@crxjs/vite-plugin` (CRXJS Vite Plugin) as dev dependencies. CRXJS handles Chrome Extension manifest integration with Vite's HMR for a smooth dev experience.
  - Create `tsconfig.json` with `strict: true`, `target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "bundler"`, and `"dom"` in `lib`.
  - Create `vite.config.ts` importing `crx` from `@crxjs/vite-plugin` and the manifest. Configure the plugin with the manifest import.

- [x] **1.2 Create the Chrome Extension manifest (`manifest.json`)**
  - Use Manifest V3.
  - Set `name`, `version` (`0.1.0`), `description`, and `manifest_version: 3`.
  - Add `content_scripts` entry:
    - `matches`: `["https://chatgpt.com/*"]`
    - `js`: point to the compiled content script entry file (e.g., `"src/content-script.ts"`; CRXJS resolves TS files).
    - `run_at`: `"document_idle"` — ensures the DOM is ready before the script runs.
  - Add `icons` section with 16, 48, and 128px icons (can be placeholder PNGs initially).
  - Add `permissions`: likely none needed beyond content script host access.
  - Ensure the manifest is compatible with both Chrome and Opera (Opera uses Chromium and supports MV3).

- [x] **1.3 Set up the project directory structure**
  ```
  chatgpt-back-to-last-position-button/
  ├── src/
  │   ├── content-script.ts       # Main entry: orchestrates observation and UI
  │   ├── scroll-tracker.ts       # Scroll position save/restore logic
  │   ├── button-manager.ts       # Creates, positions, shows/hides the button
  │   ├── dom-observer.ts         # MutationObserver helpers for ChatGPT DOM
  │   └── styles.css              # Styles for the injected button
  ├── public/
  │   └── icons/                  # Extension icons (16, 48, 128)
  ├── manifest.json
  ├── vite.config.ts
  ├── tsconfig.json
  ├── package.json
  ├── TODO.md
  └── README.md
  ```

---

### 2. Identify ChatGPT DOM Structure

- [x] **2.1 Inspect and document the ChatGPT scrollable container**
  - Open ChatGPT in the browser and use DevTools to identify the scrollable element that contains the conversation messages. This is the element whose `scrollTop` we will track.
  - Document its selector (e.g., a `div` with a specific `class`, `role`, or `data-*` attribute). ChatGPT's class names are obfuscated/hashed, so prefer attribute-based or structural selectors where possible (e.g., `[role="presentation"]` or the element matched by a known structural pattern).
  - Note: ChatGPT is a single-page app (SPA). The container may be re-created when switching between conversations, so selectors must be re-evaluated after navigation.

- [x] **2.2 Inspect and document the native "scroll to bottom" button**
  - Locate the existing "scroll to bottom" (down-arrow) button that appears when you scroll up in a conversation.
  - Document its:
    - DOM position relative to the scrollable container (e.g., is it a sibling? inside it? in a fixed overlay?).
    - CSS classes and inline styles used for positioning, sizing, shape, and colors.
    - The SVG icon used for the down arrow (copy the SVG path data).
  - We will mirror this button's style for our "up arrow" button, but positioned at the **top** of the container rather than the bottom.

- [x] **2.3 Identify the "send message" trigger**
  - Determine how to detect when the user submits a message. Options:
    - Listen for a click on the send button (identify its selector).
    - Listen for `Enter` keypress on the message textarea (identify the textarea selector).
    - Observe DOM mutations for new user message elements appearing in the chat.
  - The detection needs to fire **before** auto-scroll happens, so we can capture the pre-scroll position. A `keydown`/`click` listener is more reliable for this than a DOM mutation observer (which fires after the DOM change and possibly after auto-scroll).

---

### 3. Scroll Position Tracking (`scroll-tracker.ts`)

- [x] **3.1 Implement scroll position saving**
  - Create a `ScrollTracker` class (or a set of functions) that:
    - Holds a reference to the scrollable container element.
    - Stores the saved `scrollTop` value (the position to return to).
    - Exposes a `savePosition()` method that captures `container.scrollTop`.
    - Exposes a `getSavedPosition(): number | null` method.
    - Exposes a `clearPosition()` method to reset the saved value to `null`.

- [x] **3.2 Implement "is scrolled to bottom" detection**
  - Create an `isScrolledToBottom(container: HTMLElement): boolean` utility.
  - Logic: `container.scrollHeight - container.scrollTop - container.clientHeight < threshold` (e.g., threshold = 10px to account for sub-pixel rendering).
  - This is used to decide whether to save the position: if the user is already at the bottom, there's no position worth saving.

- [x] **3.3 Implement smooth scroll-to-position**
  - Create a `scrollToPosition(container: HTMLElement, targetScrollTop: number): void` function.
  - Use `container.scrollTo({ top: targetScrollTop, behavior: 'smooth' })` for native smooth scrolling.
  - Consider fallback: if `smooth` scrolling is not supported or is overridden by ChatGPT's own scroll behavior, implement a manual `requestAnimationFrame`-based easing animation (e.g., ease-in-out over ~400ms).

- [x] **3.4 Hook into the send-message event to save position**
  - In the content script, after identifying the textarea/send button:
    - Attach a `keydown` listener on the textarea to detect `Enter` (without `Shift`).
    - Attach a `click` listener on the send button.
    - On either event: check `isScrolledToBottom()`. If **not** at the bottom, call `savePosition()`.
  - Edge case: if the user sends multiple messages in quick succession, only the first saved position should be kept (don't overwrite with a position that's already near the bottom due to previous auto-scroll).

---

### 4. Button UI (`button-manager.ts` + `styles.css`)

- [x] **4.1 Create the "scroll to saved position" button element**
  - Create a `ButtonManager` class that:
    - Builds a `<button>` element with an **up-arrow SVG icon** inside it.
    - The SVG should be the same as ChatGPT's down-arrow icon but rotated 180° (or use a fresh up-arrow SVG path). Match stroke width, viewBox, and sizing.
    - Apply CSS classes for styling (defined in `styles.css`).
    - Attaches a click handler that calls `scrollToPosition()` with the saved scroll position, then hides the button.

- [x] **4.2 Style the button to match ChatGPT's native down-arrow button**
  - In `styles.css`, define styles scoped with a unique prefix (e.g., `.cgpt-btp-btn`) to avoid collision with ChatGPT's own styles:
    - Same dimensions as the native button (e.g., 32×32px or whatever the measured size is).
    - Same border-radius (fully rounded / circle).
    - Same background color, border, and box-shadow as the native button (match both light and dark themes if possible by using ChatGPT's CSS custom properties if available, or by detecting the theme).
    - Same hover/focus states (slight background color change, cursor pointer).
    - Smooth opacity/transform transition for show/hide animation (e.g., fade in + slight slide down from top).
  - Position the button at the **top** of the chat area, horizontally centered, mirroring how the native button sits at the bottom.
    - Use `position: sticky` or `position: absolute` + a wrapper, depending on the DOM structure. It should "stick" to the top of the visible scroll area.

- [x] **4.3 Implement show/hide logic**
  - The button should be **shown** when:
    - A scroll position has been saved (i.e., the user sent a message while not at the bottom).
    - The user is currently scrolled **away** from the saved position (i.e., auto-scroll moved them).
  - The button should be **hidden** when:
    - The user clicks it (after scrolling back).
    - The user manually scrolls to or past the saved position.
    - A new conversation is loaded (the saved position is no longer relevant).
    - No position is saved.
  - Use a CSS class toggle (e.g., `.cgpt-btp-btn--visible`) with a CSS transition for smooth appear/disappear.

---

### 5. DOM Observation & Content Script Orchestration (`dom-observer.ts`, `content-script.ts`)

- [x] **5.1 Implement a MutationObserver to detect page readiness and navigation**
  - ChatGPT is an SPA; the chat container may not exist on initial load and is replaced on conversation switches.
  - Create a `DomObserver` class with:
    - A method `waitForElement(selector: string): Promise<HTMLElement>` that uses a `MutationObserver` to resolve when the target element appears in the DOM.
    - A method `onElementRemoved(element: HTMLElement, callback: () => void)` to detect when the chat container is removed (conversation switch), so we can clean up and re-initialize.
  - Alternatively, use `MutationObserver` on `document.body` (or a stable ancestor) to watch for the chat container appearing/disappearing.

- [x] **5.2 Handle conversation switches and cleanup**
  - When the user switches to a different conversation:
    - Clear the saved scroll position.
    - Remove the injected button from the old container.
    - Re-run detection for the new container and re-attach all listeners.
  - When the page title/URL changes (use `history.pushState`/`popstate` listeners or observe URL changes with a polling interval), treat it as a potential conversation switch.

- [x] **5.3 Wire everything together in `content-script.ts`**
  - This is the main entry point that:
    1. Waits for the scrollable chat container to appear using `DomObserver`.
    2. Instantiates `ScrollTracker` with the container.
    3. Instantiates `ButtonManager` and injects the button into the DOM at the correct position.
    4. Attaches event listeners for send-message detection (keyboard + click).
    5. Attaches a `scroll` event listener on the container to update button visibility.
    6. Sets up conversation-switch detection and dynamic button re-injection.
  - [x] **5.4 Robustify for dynamic DOM**
    - [x] Handle React DOM replacements via MutationObservers.
    - [x] Prevent false bottom detection on zero-dimension elements.
  - Import `styles.css` in this file (Vite will handle injecting it into the page via the content script).

---

### 6. Theme Support

- [x] **6.1 Support both ChatGPT light and dark themes**
  - Inspect ChatGPT's theme mechanism:
    - Does it use a `data-theme` attribute on `<html>` or `<body>`?
    - Does it use CSS custom properties (e.g., `--bg-color`, `--text-color`) that change per theme?
  - If custom properties are available, use them in `styles.css` for the button's colors.
  - If not, define two sets of styles using a selector like `html[data-theme="dark"] .cgpt-btp-btn` vs `html[data-theme="light"] .cgpt-btp-btn` (or whatever attribute ChatGPT uses).
  - Test in both themes to ensure the button blends in naturally.

---

### 7. Build & Packaging

- [x] **7.1 Configure Vite build for production**
  - Ensure `vite build` produces a valid extension in `dist/`:
    - The manifest is copied to `dist/`.
    - Content script JS is bundled and output to `dist/`.
    - CSS is either inlined into the JS (CRXJS default) or output as a separate file referenced in the manifest.
    - Icons are copied to `dist/icons/`.
  - Test the production build by loading `dist/` as an unpacked extension.

- [x] **7.2 Create a ZIP packaging script**
  - Add a `package.json` script (e.g., `"zip": "cd dist && zip -r ../extension.zip ."`) to create a `.zip` file suitable for uploading to the Chrome Web Store and Opera Add-ons.
  - Ensure the ZIP doesn't include source maps or dev artifacts.

---

### 8. Extension Icons & Metadata

- [x] **8.1 Create extension icons**
  - Design or generate icons at 16×16, 48×48, and 128×128 pixels.
  - The icon should visually convey "scroll up" or "back to position" — e.g., an up arrow or a bookmark-style icon.
  - Place in `public/icons/icon-16.png`, `public/icons/icon-48.png`, `public/icons/icon-128.png`.

- [x] **8.2 Write a README.md**
  - Describe the extension's purpose and behavior.
  - Include installation instructions (Chrome: load unpacked, Opera: same process).
  - Include development instructions (`pnpm install`, `pnpm dev`, `pnpm build`).
  - Add a screenshot or GIF demo of the button in action.

---

### 9. Testing & QA

- [ ] **9.1 Manual testing checklist**
  - [ ] Extension loads without errors in Chrome.
  - [ ] Extension loads without errors in Opera.
  - [ ] Button does NOT appear when the user is already at the bottom of the chat.
  - [ ] Button DOES appear after sending a message while scrolled up.
  - [ ] Clicking the button smoothly scrolls to the saved position.
  - [ ] Button disappears after clicking it.
  - [ ] Button disappears when manually scrolling back to the saved position.
  - [ ] Switching conversations clears the button and saved position.
  - [ ] Works correctly in ChatGPT dark theme.
  - [ ] Works correctly in ChatGPT light theme.
  - [ ] Button doesn't flicker or re-appear unexpectedly during streaming responses.
  - [ ] No console errors or warnings from the extension.
  - [ ] No interference with ChatGPT's native "scroll to bottom" button.

- [ ] **9.2 Edge cases to verify**
  - [ ] Sending a message when very close to the bottom (within threshold) — button should NOT appear.
  - [ ] Very long conversations with lots of scroll distance — smooth scroll should still work.
  - [ ] Rapid-fire message sends — saved position should be the first one, not overwritten.
  - [ ] Page refresh mid-conversation — button should not appear (no stale saved position).
  - [ ] Resizing the browser window — button positioning should remain correct.
  - [ ] ChatGPT model selector / system prompt area at the top — button should not conflict.

---

### 10. Publishing

- [ ] **10.1 Publish to Chrome Web Store**
  - Create a developer account if not already done.
  - Upload the ZIP.
  - Fill in store listing: description, screenshots, category, and privacy info.
  - Submit for review.

- [ ] **10.2 Publish to Opera Add-ons**
  - Create a developer account on the Opera Add-ons portal.
  - Upload the same ZIP (or an Opera-specific build if needed).
  - Fill in store listing details.
  - Submit for review.
