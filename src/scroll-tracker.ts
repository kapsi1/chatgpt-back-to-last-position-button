const BOTTOM_THRESHOLD_PX = 10;

/**
 * Checks whether the given scrollable element is scrolled to (or very near) the bottom.
 */
export function isScrolledToBottom(container: HTMLElement): boolean {
  return (
    container.scrollHeight - container.scrollTop - container.clientHeight <
    BOTTOM_THRESHOLD_PX
  );
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
    if (this.savedScrollTop !== null) return; // already saved
    if (isScrolledToBottom(container)) return; // nothing to save
    this.savedScrollTop = container.scrollTop;
  }

  getSavedPosition(): number | null {
    return this.savedScrollTop;
  }

  clearPosition(): void {
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
