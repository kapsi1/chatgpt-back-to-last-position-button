import { log, warn } from "./logger";

const BOTTOM_THRESHOLD_PX = 10;

/**
 * Checks whether the given scrollable element is scrolled to (or very near) the bottom.
 */
export function isScrolledToBottom(container: HTMLElement): boolean {
  const { scrollTop, scrollHeight, clientHeight } = container;
  
  // If dimensions are zero, something is wrong (element hidden or detached)
  // We should not treat this as "at bottom".
  if (scrollHeight === 0 && clientHeight === 0) {
    warn("isScrolledToBottom: Zero dimensions, ignoring check.");
    return false;
  }

  const isAtBottom = scrollHeight - scrollTop - clientHeight < BOTTOM_THRESHOLD_PX;
  log(`isScrolledToBottom: st=${scrollTop} sh=${scrollHeight} ch=${clientHeight} atBottom=${isAtBottom}`);
  return isAtBottom;
}

/**
 * Keeps track of a single saved scroll position for the chat container.
 */
export class ScrollTracker {
  private savedScrollTop: number | null = null;

  /**
   * Save the current `scrollTop` of the container.
   * Does nothing if the user is already at the bottom.
   * If a position is already saved, it is NOT overwritten (to preserve the
   * original reading position across rapid message sends).
   */
  savePosition(container: HTMLElement): void {
    const atBottom = isScrolledToBottom(container);
    if (atBottom) {
      log("savePosition: container at the bottom, skipping");
      return; 
    }
    this.savedScrollTop = container.scrollTop;
    log("savePosition: saved/updated to", this.savedScrollTop);
  }

  getSavedPosition(): number | null {
    return this.savedScrollTop;
  }

  clearPosition(): void {
    log("clearPosition");
    this.savedScrollTop = null;
  }

  hasSavedPosition(): boolean {
    return this.savedScrollTop !== null;
  }
}

/**
 * Smoothly scrolls the container to the given `scrollTop` position.
 * Falls back to a manual `requestAnimationFrame` animation if native smooth
 * scrolling is not supported or gets hijacked by ChatGPT.
 */
export function scrollToPosition(
  container: HTMLElement,
  targetScrollTop: number,
): void {
  // Clamp to valid range
  const max = container.scrollHeight - container.clientHeight;
  const clamped = Math.max(0, Math.min(targetScrollTop, max));

  container.scrollTo({ top: clamped, behavior: "smooth" });
}
