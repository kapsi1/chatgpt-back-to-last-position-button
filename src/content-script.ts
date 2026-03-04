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

const LOG_PREFIX = "[CGPT-BTP]";

function log(...args: unknown[]) {
  console.log(LOG_PREFIX, ...args);
}

// ── Selectors (derived from ChatGPT's DOM) ─────────────────────────
// The main scrollable area for chat messages.  ChatGPT usually has
// several [data-scroll-root] elements (sidebar, main chat, etc.),
// but the main one is inside the <main> element.
const SCROLL_ROOT_SELECTOR = "main [data-scroll-root]";
const COMPOSER_FORM_SELECTOR = 'form[data-type="unified-composer"]';
const PROMPT_TEXTAREA_SELECTOR = "#prompt-textarea";
const SEND_BUTTON_SELECTOR =
  'button[data-testid="send-button"], button.composer-submit-button-color';

// ── State ──────────────────────────────────────────────────────────
const tracker = new ScrollTracker();
const buttonManager = new ButtonManager();
let cleanups: (() => void)[] = [];

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
  log("initForContainer", scrollRoot);
  // Manual cleanups here because we want to preserve tracker/buttonManager state
  for (const fn of cleanups) fn();
  cleanups = [];

  // Inject the button into the scroll container
  buttonManager.inject(scrollRoot, () => {
    const pos = tracker.getSavedPosition();
    log("Button clicked, saved position:", pos);
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
      log("onBeforeSend - user submitted message (via fallback/Enter)");
      const roots = Array.from(document.querySelectorAll<HTMLElement>("[data-scroll-root]"));
      const liveRoot = roots.find(r => r.querySelector('[data-turn-id]') && r.offsetHeight > 0) || roots[0];
      
      if (liveRoot) {
        tracker.savePosition(liveRoot);
      } else {
        log("ERROR: No scroll root found during Enter key!");
      }
    };

    // Capture Enter key (without Shift) on the prompt textarea
    if (textarea) {
      log("Attaching Enter key listener to textarea");
      const handler = (e: Event) => {
        const ke = e as KeyboardEvent;
        if (ke.key === "Enter" && !ke.shiftKey) {
          log("Enter key detected");
          onBeforeSend();
        }
      };
      textarea.addEventListener("keydown", handler, { capture: true });
      cleanups.push(() =>
        textarea.removeEventListener("keydown", handler, { capture: true }),
      );
    }

    // Capture mousedown on the send button
    if (form) {
      log("Attaching mousedown listener to composer form");
      const handler = (e: Event) => {
        const target = e.target as HTMLElement | null;
        const btn = target?.closest("button");
        if (btn) {
          log("Button mousedown in form:", btn.getAttribute("aria-label") || btn.dataset.testid || "unknown button");
          
          if (btn.closest(SEND_BUTTON_SELECTOR) || 
              btn.getAttribute("aria-label")?.toLowerCase().includes("send") ||
              btn.dataset.testid === "send-button") {
            log("Send button detection triggered (mousedown)");
            
            // Re-identify the correct scroll root that holds the messages
            const roots = Array.from(document.querySelectorAll<HTMLElement>("[data-scroll-root]"));
            const liveRoot = roots.find(r => r.querySelector('[data-turn-id]') && r.offsetHeight > 0) || roots[0];
            
            if (liveRoot) {
              tracker.savePosition(liveRoot);
            } else {
              log("ERROR: No scroll root found during send!");
            }
          }
        }
      };
      // Use mousedown to beat most other listeners
      form.addEventListener("mousedown", handler, { capture: true });
      cleanups.push(() =>
        form.removeEventListener("mousedown", handler, { capture: true }),
      );
    }
  };

  attachSendListeners();

  const composerObserver = new MutationObserver(() => {
    const form = document.querySelector<HTMLFormElement>(COMPOSER_FORM_SELECTOR);
    if (form && !form.dataset.btpListenersAttached) {
      log("Composer form refreshed - re-attaching listeners");
      form.dataset.btpListenersAttached = "1";
      attachSendListeners();
    }
  });
  composerObserver.observe(document.body, { childList: true, subtree: true });
  cleanups.push(() => composerObserver.disconnect());

  // ── Watch for button removal (if React replaces innerHTML) ───────
  const rootObserver = new MutationObserver(() => {
    if (!buttonManager.isAttached()) {
      log("Button removed from scrollRoot - re-injecting");
      buttonManager.inject(scrollRoot, () => {
        const pos = tracker.getSavedPosition();
        if (pos !== null) {
          buttonManager.scrollTo(pos);
          tracker.clearPosition();
        }
      });
    }
  });
  rootObserver.observe(scrollRoot, { childList: true });
  cleanups.push(() => rootObserver.disconnect());

  // ── Scroll listener — show / hide button ───────────────────────
  // We use a global listener because ChatGPT swaps the scroll container frequently.
  const handleScroll = rafThrottle(() => {
    log("handleScroll heartbeat");
    // Re-acquire the live conversation root
    const roots = Array.from(document.querySelectorAll<HTMLElement>("[data-scroll-root]"));
    const liveRoot = roots.find(r => r.querySelector('[data-turn-id]') && r.offsetHeight > 0) || roots[0];

    if (!liveRoot) return;

    // Ensure button is in the live root
    if (!buttonManager.isAttached() || buttonManager.getContainer() !== liveRoot) {
      log("Ensuring button is attached to live root");
      buttonManager.inject(liveRoot, () => {
        const pos = tracker.getSavedPosition();
        if (pos !== null) {
          buttonManager.scrollTo(pos);
          tracker.clearPosition();
        }
      });
    }

    const savedPos = tracker.getSavedPosition();
    if (savedPos !== null) {
      if (!buttonManager.isVisible()) {
        log(`Position saved at ${savedPos}. Showing button.`);
        buttonManager.show();
      }
    } else {
      if (buttonManager.isVisible()) {
        log("No position saved. Hiding button.");
        buttonManager.hide();
      }
    }
  });

  window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
  cleanups.push(() => window.removeEventListener("scroll", handleScroll, { capture: true }));
}

/**
 * Cleans up all listeners and removes the button from the DOM.
 */
function teardown(clearPosition = true): void {
  log("Teardown called, clearPosition:", clearPosition);
  for (const fn of cleanups) fn();
  cleanups = [];
  buttonManager.destroy();
  if (clearPosition) {
    tracker.clearPosition();
  }
}

// ── Bootstrap ──────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  log("Bootstrap started");
  
  // Find the scroll root that is actually scrollable and contains the chat
  const findActiveScrollRoot = (): HTMLElement | null => {
    const roots = Array.from(document.querySelectorAll<HTMLElement>("[data-scroll-root]"));
    log(`Found ${roots.length} total potential scroll roots`);
    
    for (const r of roots) {
      const hasTurns = r.querySelector('[data-turn-id]') !== null;
      const isVisible = r.offsetHeight > 0;
      log(`Candidate: turns=${hasTurns} vis=${isVisible} sh=${r.scrollHeight} ch=${r.clientHeight} class=${r.className.slice(0, 50)}...`);
      
      // The main chat container should contain turns and be visible
      if (hasTurns && isVisible) return r;
    }
    
    // Fallback to the one inside <main>
    return document.querySelector<HTMLElement>(SCROLL_ROOT_SELECTOR) || roots[0] || null;
  };

  let scrollRoot = findActiveScrollRoot();
  if (!scrollRoot) {
    log("Waiting for scrollRoot...");
    scrollRoot = await waitForElement(SCROLL_ROOT_SELECTOR);
  }
  
  if (scrollRoot) {
    log("scrollRoot selected:", scrollRoot.tagName, {
      id: scrollRoot.id,
      sh: scrollRoot.scrollHeight,
      ch: scrollRoot.clientHeight
    });
    initForContainer(scrollRoot);
  }

  // Re-initialise on SPA navigation
  const cleanupUrlWatcher = onUrlChange(async (newPath) => {
    log("URL change detected:", newPath);
    // When starting a new thread, the URL changes from / to /c/ID.
    // We want to preserve the saved scroll position across this specific transition.
    const isNewThreadTransition = tracker.hasSavedPosition();
    teardown(!isNewThreadTransition /* clear only if not in a conversation transition */);
    const newRoot = await waitForElement(SCROLL_ROOT_SELECTOR);
    log("New scrollRoot found after navigation:", newRoot);
    initForContainer(newRoot);
  });
  cleanups.push(cleanupUrlWatcher);
}

bootstrap();
