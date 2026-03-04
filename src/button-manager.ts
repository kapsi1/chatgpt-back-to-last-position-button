import { scrollToPosition } from "./scroll-tracker";
import { log } from "./logger";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Builds the up-arrow SVG icon via DOM APIs (avoids innerHTML).
 * Same viewBox and sizing as ChatGPT's native down-arrow icon, but pointing upward.
 */
function createUpArrowSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  const line = document.createElementNS(SVG_NS, "line");
  line.setAttribute("x1", "12");
  line.setAttribute("y1", "19");
  line.setAttribute("x2", "12");
  line.setAttribute("y2", "5");
  svg.appendChild(line);

  const polyline = document.createElementNS(SVG_NS, "polyline");
  polyline.setAttribute("points", "5 12 12 5 19 12");
  svg.appendChild(polyline);

  return svg;
}

export class ButtonManager {
  private button: HTMLButtonElement | null = null;
  private scrollContainer: HTMLElement | null = null;
  private onScrollBack: (() => void) | null = null;

  /**
   * Creates (or re-uses) the button element, injects it into the given
   * scroll container, and wires the click handler.
   */
  inject(
    scrollContainer: HTMLElement,
    onScrollBack: () => void,
  ): void {
    log("ButtonManager.inject into", scrollContainer);
    this.scrollContainer = scrollContainer;
    this.onScrollBack = onScrollBack;

    if (!this.button) {
      this.button = document.createElement("button");
      this.button.className = "cgpt-btp-btn";
      this.button.setAttribute("aria-label", "Scroll to last reading position");
      this.button.appendChild(createUpArrowSvg());
      this.button.addEventListener("click", this.handleClick);
    }

    // The button needs to be inside the scroll-root to participate in its
    // positioning context. We prepend it so it starts at the top of the content flow,
    // which helps with 'position: sticky'.
    if (!scrollContainer.contains(this.button)) {
      log("Prepending button to scroll container", {
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
    log("ButtonManager.show");
    this.button?.classList.add("cgpt-btp-btn--visible");
  }

  hide(): void {
    log("ButtonManager.hide");
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
      log("scrollTo: No scroll container!");
      return;
    }
    log("scrollTo:", targetScrollTop);
    scrollToPosition(this.scrollContainer, targetScrollTop);
    this.hide();
  }
}
