import { log } from "./logger";

const WAIT_TIMEOUT_MS = 30_000;

/**
 * Resolves when an element matching `selector` appears in the DOM.
 * If the element already exists, resolves immediately.
 * Rejects after `WAIT_TIMEOUT_MS` to prevent leaked observers.
 */
export function waitForElement(selector: string): Promise<HTMLElement> {
  log("waitForElement searching for:", selector);
  const existing = document.querySelector<HTMLElement>(selector);
  if (existing) {
    log("waitForElement found existing:", selector);
    return Promise.resolve(existing);
  }

  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) {
        log("MutationObserver found element:", selector);
        clearTimeout(timer);
        observer.disconnect();
        resolve(el);
      }
    });

    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`waitForElement("${selector}") timed out after ${WAIT_TIMEOUT_MS}ms`));
    }, WAIT_TIMEOUT_MS);

    observer.observe(document.body, { childList: true, subtree: true });
  });
}

/**
 * Detects SPA-style URL changes (pushState / popstate) and calls `callback`
 * with the new URL path.  Returns a cleanup function.
 */
export function onUrlChange(callback: (newPath: string) => void): () => void {
  let lastPath = location.pathname;

  const check = () => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      callback(lastPath);
    }
  };

  // Monkey-patch pushState so we detect programmatic navigation too
  const origPushState = history.pushState.bind(history);
  history.pushState = (...args: Parameters<typeof history.pushState>) => {
    origPushState(...args);
    check();
  };

  const origReplaceState = history.replaceState.bind(history);
  history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
    origReplaceState(...args);
    check();
  };

  window.addEventListener("popstate", check);

  return () => {
    history.pushState = origPushState;
    history.replaceState = origReplaceState;
    window.removeEventListener("popstate", check);
  };
}
