// Hover for the virtual pointer (docs/ui/input-and-onboarding.md §4.1, #794). While the pointer is locked every mouse
// event goes to the canvas host, so the HUD controls that take the pointer (the trait cards, the leaderboard header)
// would never hear it arrive. This walks the elements under the virtual pointer and dispatches the `mouseenter` and
// `mouseleave` the browser would have, outermost first in and innermost first out, so a card highlights and
// previews its trait exactly as it does under the real cursor.

const MOUSE_ENTER = 'mouseenter';
const MOUSE_LEAVE = 'mouseleave';

/** The element and its ancestors, innermost first, up to and excluding the document. */
function ancestryOf(element: Element | null): Element[] {
  const chain: Element[] = [];
  for (let current = element; current !== null; current = current.parentElement) chain.push(current);
  return chain;
}

export class VirtualHover {
  private hovered: Element[] = [];

  /** The pointer is now over `element` (`null`: over nothing that takes the pointer). */
  moveTo(element: Element | null): void {
    const next = ancestryOf(element);
    const left = this.hovered.filter((previous) => !next.includes(previous));
    const entered = next.filter((candidate) => !this.hovered.includes(candidate)).reverse();
    this.hovered = next;
    for (const leftElement of left) leftElement.dispatchEvent(new MouseEvent(MOUSE_LEAVE));
    for (const enteredElement of entered) enteredElement.dispatchEvent(new MouseEvent(MOUSE_ENTER));
  }

  /** The virtual pointer is gone (the lock ended): whatever it was over is left, so no highlight outlives it. */
  clear(): void {
    this.moveTo(null);
  }
}
