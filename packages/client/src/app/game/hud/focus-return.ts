// Where focus goes when a non-modal overlay closes (docs/ui/input-and-onboarding.md §4, docs/ui/overlays.md §3.2).
// The trait picker traps nothing, because the cell keeps steering, but focus that went into it must not be dropped
// on the page body when its controls go away: it returns to the element it came from (the canvas host). Focus the
// player moved out of the overlay on their own is theirs, and is never taken back.

export class FocusReturn {
  private returnTarget: HTMLElement | null = null;

  /** A `focusin` on the container: remember where focus came from, on its first entry only. */
  enter(event: FocusEvent): void {
    const container = event.currentTarget;
    const origin = event.relatedTarget;
    if (this.returnTarget !== null || !(container instanceof Element) || !(origin instanceof HTMLElement)) return;
    if (!container.contains(origin)) this.returnTarget = origin;
  }

  /** A `focusout` on the container: focus that moved outside it on its own releases the return. */
  leave(event: FocusEvent): void {
    const container = event.currentTarget;
    const next = event.relatedTarget;
    if (container instanceof Element && next instanceof Node && !container.contains(next)) this.returnTarget = null;
  }

  /** The container is gone: send focus back if it was left on nothing. */
  restore(ownerDocument: Document): void {
    const target = this.returnTarget;
    this.returnTarget = null;
    const active = ownerDocument.activeElement;
    const isFocusDropped = active === null || active === ownerDocument.body;
    if (target !== null && target.isConnected && isFocusDropped) target.focus();
  }
}
