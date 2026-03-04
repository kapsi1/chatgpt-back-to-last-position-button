import { scrollToPosition } from "./scroll-tracker";

/**
 * Up-arrow SVG icon — same viewBox and sizing as ChatGPT's native
 * down-arrow icon, but pointing upward.
 */
const UP_ARROW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>`;

export class ButtonManager {
  private button: HTMLButtonElement | null = null;
  private scrollContainer: HTMLElement | null = null;
  private onScrollBack: (() => void) | null = null;

  /**
   * Creates (or re-uses) the button element, injects it into the given
   * `anchor` element, and wires the click handler.
   *
   * @param anchor   The element the button will be appended to (should be
   *                 the `[data-scroll-root]` container so it scrolls with it).
   * @param onScrollBack  Called after scrolling back so the caller can clean
   *                      up the saved position.
   */
  inject(
    scrollContainer: HTMLElement,
    onScrollBack: () => void,
  ): void {
    console.log("[CGPT-BTP] ButtonManager.inject into", scrollContainer);
    this.scrollContainer = scrollContainer;
    this.onScrollBack = onScrollBack;

    if (!this.button) {
      this.button = document.createElement("button");
      this.button.className = "cgpt-btp-btn";
      this.button.setAttribute("aria-label", "Scroll to last reading position");
      this.button.innerHTML = UP_ARROW_SVG;
      this.button.addEventListener("click", this.handleClick);
    }

    // The button needs to be inside the scroll-root to participate in its
    // positioning context. We prepend it so it starts at the top of the content flow,
    // which helps with 'position: sticky'.
    if (!scrollContainer.contains(this.button)) {
      console.log("[CGPT-BTP] Prepending button to scroll container", {
        tag: scrollContainer.tagName,
        sh: scrollContainer.scrollHeight
      });
      scrollContainer.prepend(this.button);
    }
  }

  isAttached(): boolean {
    return (
      this.button !== null &&
      this.scrollContainer !== null &&
      this.scrollContainer.contains(this.button)
    );
  }

  getContainer(): HTMLElement | null {
    return this.scrollContainer;
  }

  show(): void {
    console.log("[CGPT-BTP] ButtonManager.show");
    this.button?.classList.add("cgpt-btp-btn--visible");
  }

  hide(): void {
    console.log("[CGPT-BTP] ButtonManager.hide");
    this.button?.classList.remove("cgpt-btp-btn--visible");
  }

  isVisible(): boolean {
    return this.button?.classList.contains("cgpt-btp-btn--visible") ?? false;
  }

  /**
   * Removes the button from the DOM and clears internal state.
   */
  destroy(): void {
    this.button?.remove();
    this.button = null;
    this.scrollContainer = null;
    this.onScrollBack = null;
  }

  // ── Private ───────────────────────────────────────────────────────

  private handleClick = (e: Event): void => {
    e.preventDefault();
    e.stopPropagation();

    // The caller is expected to provide the actual scrollTop via onScrollBack
    // which in turn calls scrollToPosition.  But we also call it here directly
    // for robustness — the content-script wires everything such that
    // `onScrollBack` triggers the scroll.
    this.onScrollBack?.();
  };

  /**
   * Scroll to a specific position and hide the button afterwards.
   */
  scrollTo(targetScrollTop: number): void {
    if (!this.scrollContainer) {
      console.log("[CGPT-BTP] scrollTo: No scroll container!");
      return;
    }
    console.log("[CGPT-BTP] scrollTo:", targetScrollTop);
    scrollToPosition(this.scrollContainer, targetScrollTop);
    this.hide();
  }
}
