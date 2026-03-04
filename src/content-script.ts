/**
 * ChatGPT "Back to Last Position" — content script entry point.
 *
 * This script is injected into chatgpt.com by the browser extension.  It:
 *   1. Waits for the scrollable chat container (`[data-scroll-root]`) to appear.
 *   2. Listens for "send message" events (Enter key / send-button click).
 *   3. Saves the scroll position if the user isn't already at the bottom.
 *   4. Shows an up-arrow button at the top of the viewport.
 *   5. Clicking the button smoothly scrolls back to the saved position.
 *   6. Re-initialises on SPA navigation (conversation switch).
 */

import "./styles.css";
import { ScrollTracker } from "./scroll-tracker";
import { ButtonManager } from "./button-manager";
import { waitForElement, onUrlChange } from "./dom-observer";

// ── Selectors (derived from ChatGPT's DOM) ─────────────────────────
const SCROLL_ROOT_SELECTOR = "[data-scroll-root]";
const COMPOSER_FORM_SELECTOR = 'form[data-type="unified-composer"]';
const PROMPT_TEXTAREA_SELECTOR = "#prompt-textarea";
const SEND_BUTTON_SELECTOR =
  'form[data-type="unified-composer"] button.composer-submit-button-color';

// ── State ──────────────────────────────────────────────────────────
let tracker = new ScrollTracker();
let buttonManager = new ButtonManager();
let cleanups: (() => void)[] = [];
let scrollListenerAttached = false;

// ── Helpers ────────────────────────────────────────────────────────

/** Throttle helper — runs `fn` at most once per animation frame. */
function rafThrottle(fn: () => void): () => void {
  let pending = false;
  return () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      fn();
      pending = false;
    });
  };
}

/**
 * Main initialisation for a given scroll-root element.
 * Attaches all event listeners and the button.
 */
function initForContainer(scrollRoot: HTMLElement): void {
  teardown(); // clean up any previous instance

  tracker = new ScrollTracker();
  buttonManager = new ButtonManager();

  // Inject the button into the scroll container
  buttonManager.inject(scrollRoot, () => {
    const pos = tracker.getSavedPosition();
    if (pos !== null) {
      buttonManager.scrollTo(pos);
      tracker.clearPosition();
    }
  });

  // ── Listen for "send message" ──────────────────────────────────
  const attachSendListeners = () => {
    const form = document.querySelector<HTMLFormElement>(COMPOSER_FORM_SELECTOR);
    const textarea = document.querySelector<HTMLElement>(
      PROMPT_TEXTAREA_SELECTOR,
    );

    const onBeforeSend = () => {
      tracker.savePosition(scrollRoot);
    };

    // Capture Enter key (without Shift) on the prompt textarea
    if (textarea) {
      const handler = (e: Event) => {
        const ke = e as KeyboardEvent;
        if (ke.key === "Enter" && !ke.shiftKey) {
          onBeforeSend();
        }
      };
      textarea.addEventListener("keydown", handler, { capture: true });
      cleanups.push(() =>
        textarea.removeEventListener("keydown", handler, { capture: true }),
      );
    }

    // Capture click on the send button
    if (form) {
      const handler = (e: Event) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest(SEND_BUTTON_SELECTOR)) {
          onBeforeSend();
        }
      };
      form.addEventListener("click", handler, { capture: true });
      cleanups.push(() =>
        form.removeEventListener("click", handler, { capture: true }),
      );
    }
  };

  attachSendListeners();

  // Re-attach send listeners when the composer form is replaced (e.g. after
  // a conversation switch where the DOM is rebuilt but scrollRoot remains).
  const composerObserver = new MutationObserver(() => {
    const form = document.querySelector<HTMLFormElement>(COMPOSER_FORM_SELECTOR);
    if (form && !form.dataset.btpListenersAttached) {
      form.dataset.btpListenersAttached = "1";
      attachSendListeners();
    }
  });
  composerObserver.observe(document.body, { childList: true, subtree: true });
  cleanups.push(() => composerObserver.disconnect());

  // ── Scroll listener — show / hide button ───────────────────────
  const onScroll = rafThrottle(() => {
    const savedPos = tracker.getSavedPosition();
    if (savedPos === null) {
      buttonManager.hide();
      return;
    }

    // Show the button when the user has been auto-scrolled away from their
    // saved position (i.e. they are now further down).
    const currentScroll = scrollRoot.scrollTop;
    const isAwayFromSaved = currentScroll > savedPos + 50;

    if (isAwayFromSaved) {
      buttonManager.show();
    }

    // If the user manually scrolled back to (or past) the saved position,
    // clear it and hide the button.
    if (currentScroll <= savedPos + 10 && buttonManager.isVisible()) {
      tracker.clearPosition();
      buttonManager.hide();
    }
  });

  if (!scrollListenerAttached) {
    scrollRoot.addEventListener("scroll", onScroll, { passive: true });
    scrollListenerAttached = true;
    cleanups.push(() => {
      scrollRoot.removeEventListener("scroll", onScroll);
      scrollListenerAttached = false;
    });
  }
}

/**
 * Cleans up all listeners and removes the button from the DOM.
 */
function teardown(): void {
  for (const fn of cleanups) fn();
  cleanups = [];
  buttonManager.destroy();
  tracker.clearPosition();
  scrollListenerAttached = false;
}

// ── Bootstrap ──────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  const scrollRoot = await waitForElement(SCROLL_ROOT_SELECTOR);
  initForContainer(scrollRoot);

  // Re-initialise on SPA navigation
  const cleanupUrlWatcher = onUrlChange(async () => {
    teardown();
    const newRoot = await waitForElement(SCROLL_ROOT_SELECTOR);
    initForContainer(newRoot);
  });
  cleanups.push(cleanupUrlWatcher);
}

bootstrap();
