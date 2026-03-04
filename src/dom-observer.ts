import { log } from "./logger";
/**
 * Resolves when an element matching `selector` appears in the DOM.
 * If the element already exists, resolves immediately.
 */
export function waitForElement(selector: string): Promise<HTMLElement> {
  log("waitForElement searching for:", selector);
  const existing = document.querySelector<HTMLElement>(selector);
  if (existing) {
    log("waitForElement found existing:", selector);
    return Promise.resolve(existing);
  }

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) {
        log("MutationObserver found element:", selector);
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

/**
 * Calls `callback` whenever a NEW element matching `selector` appears in the
 * DOM (e.g. after a SPA page navigation). Returns a cleanup function.
 */
export function onElementAppear(
  selector: string,
  callback: (el: HTMLElement) => void,
): () => void {
  let current = document.querySelector<HTMLElement>(selector);
  if (current) callback(current);

  const observer = new MutationObserver(() => {
    const el = document.querySelector<HTMLElement>(selector);
    if (el && el !== current) {
      current = el;
      callback(el);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
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
