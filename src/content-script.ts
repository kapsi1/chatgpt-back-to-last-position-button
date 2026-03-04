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
import { log } from "./logger";

// ── Selectors (derived from ChatGPT's DOM) ─────────────────────────
// The main scrollable area for chat messages.  ChatGPT usually has
// several [data-scroll-root] elements (sidebar, main chat, etc.),
// but the main one is inside the <main> element.
const SCROLL_ROOT_SELECTOR = "main [data-scroll-root], [data-scroll-root]";

const PROMPT_TEXTAREA_SELECTOR = "#prompt-textarea, [contenteditable='true'], textarea";
const SEND_BUTTON_SELECTOR =
  'button[data-testid="send-button"], button.composer-submit-button-color, button[aria-label*="send" i]';

// ── State ──────────────────────────────────────────────────────────
const tracker = new ScrollTracker();
const buttonManager = new ButtonManager();
let cleanups: (() => void)[] = [];
let cachedScrollRoot: HTMLElement | null = null;
let navigationInProgress = false;

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
 * Finds the scroll-root that actually contains the conversation messages.
 * Prefers a visible root with `[data-turn-id]` children; falls back to
 * the first `[data-scroll-root]` inside `<main>`.
 */
function findLiveScrollRoot(): HTMLElement | null {
  if (cachedScrollRoot?.isConnected && cachedScrollRoot.offsetHeight > 0) {
    return cachedScrollRoot;
  }

  const roots = Array.from(
    document.querySelectorAll<HTMLElement>("[data-scroll-root]"),
  );
  const found = (
    roots.find(
      (r) => r.querySelector("[data-turn-id]") && r.offsetHeight > 0,
    ) ??
    document.querySelector<HTMLElement>(SCROLL_ROOT_SELECTOR) ??
    roots[0] ??
    null
  );

  if (found) {
    cachedScrollRoot = found;
  }
  return found;
}

/** Shared callback wired to the "scroll back" button. */
function scrollBack(): void {
  const pos = tracker.getSavedPosition();
  log("scrollBack clicked, saved position:", pos);
  if (pos !== null) {
    buttonManager.scrollTo(pos);
    tracker.clearPosition();
  }
}

function onBeforeSend(): void {
  log("onBeforeSend - detected user message submission");
  const liveRoot = findLiveScrollRoot();
  if (liveRoot) {
    tracker.savePosition(liveRoot);
  } else {
    log("ERROR: No scroll root found during send! document.body scrollHeight:", document.body.scrollHeight);
  }
}

// ── Global Event Delegation ────────────────────────────────────────

/**
 * Setup global listeners to catch "send" events regardless of React leaf churn.
 * We use the capture phase to try and beat ChatGPT's own stopPropagation.
 */
function setupGlobalListeners(): void {
  log("Setting up global delegation listeners");
  
  const keyHandler = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      const target = e.target as HTMLElement;
      if (target?.matches?.(PROMPT_TEXTAREA_SELECTOR) || target?.closest?.(PROMPT_TEXTAREA_SELECTOR)) {
        log("Global Enter detected on prompt element");
        onBeforeSend();
      }
    }
  };

  const mouseHandler = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const btn = target?.closest?.("button");
    if (btn) {
      const label = btn.getAttribute("aria-label")?.toLowerCase() || "";
      const testid = btn.dataset.testid || "";
      const isSend = btn.matches(SEND_BUTTON_SELECTOR) || 
                     label.includes("send") || 
                     testid === "send-button";
      
      if (isSend) {
        log("Global Send button click detected", { label, testid });
        onBeforeSend();
      }
    }
  };

  window.addEventListener("keydown", keyHandler, { capture: true, passive: true });
  window.addEventListener("mousedown", mouseHandler, { capture: true, passive: true });
}

function initForContainer(scrollRoot: HTMLElement): void {
  log("initForContainer initializing for root", scrollRoot);
  // Manual cleanups here because we want to preserve tracker/buttonManager state
  for (const fn of cleanups) fn();
  cleanups = [];

  const mainEl = document.querySelector("main");

  // Inject the button globally into the body.
  buttonManager.inject(document.body, scrollRoot, scrollBack);

  // ── Position Watcher ──────────────────────────────────────────
  // Use ResizeObserver to update button centering whenever the chat layout changes
  // (e.g. sidebar toggle, window resize) without taxing the scroll event.
  if (mainEl) {
    const resizeObserver = new ResizeObserver(() => {
      buttonManager.updatePosition(mainEl as HTMLElement);
    });
    resizeObserver.observe(mainEl);
    resizeObserver.observe(document.body);
    cleanups.push(() => resizeObserver.disconnect());
    // Initial position
    buttonManager.updatePosition(mainEl as HTMLElement);
  }

  // ── Scroll listener — show / hide button ───────────────────────
  let lastSavedPos: number | null = null;
  let lastVisibility: boolean = false;

  const handleScroll = rafThrottle(() => {
    if (navigationInProgress) return;
    
    // Ensure button is ready
    if (!buttonManager.isAttached()) {
      buttonManager.inject(document.body, findLiveScrollRoot() || scrollRoot, scrollBack);
    }

    const savedPos = tracker.getSavedPosition();
    const isVisible = buttonManager.isVisible();

    if (savedPos !== lastSavedPos || isVisible !== lastVisibility) {
      if (savedPos !== null) {
        if (!isVisible) {
          log(`Position saved at ${savedPos}. Showing button.`);
          buttonManager.show();
        }
      } else {
        if (isVisible) {
          log("No position saved. Hiding button.");
          buttonManager.hide();
        }
      }
      lastSavedPos = savedPos;
      lastVisibility = buttonManager.isVisible();
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
  cachedScrollRoot = null;
  if (clearPosition) {
    tracker.clearPosition();
  }
}

// ── Bootstrap ──────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  log("Bootstrap started");
  setupGlobalListeners();

  const startForCurrentPage = async () => {
    const scrollRoot = findLiveScrollRoot() || await waitForElement(SCROLL_ROOT_SELECTOR);
    if (scrollRoot) {
      log("Bootstrap: scrollRoot found, initializing:", scrollRoot.tagName);
      initForContainer(scrollRoot);
    }
  };

  await startForCurrentPage();

  // Re-initialise on SPA navigation
  // Note: We don't add THIS cleanup to the 'cleanups' array because 
  // teardown() clears 'cleanups', and we want the URL watcher to persist.
  onUrlChange(async (newPath) => {
    if (navigationInProgress) return;
    navigationInProgress = true;

    log("URL change detected:", newPath);

    // Hide button and clear position immediately on navigation.
    // Any scroll state from the old thread is irrelevant in the new one.
    buttonManager.hide();
    teardown(true);
    
    try {
      const mainEl = document.querySelector("main");
      // Wait for ANY scroll root to appear, then we will use findLiveScrollRoot to find the message container
      await waitForElement("[data-scroll-root]", mainEl || document.body);
      const newRoot = findLiveScrollRoot();
      log("Live scrollRoot found after navigation:", newRoot);
      if (newRoot) {
        initForContainer(newRoot);
      } else {
        log("Navigation: No live scroll root after waiting.");
      }
    } catch {
      log("Navigation: new scroll root not found or timed out.");
    } finally {
      navigationInProgress = false;
    }
  });
}

bootstrap();
