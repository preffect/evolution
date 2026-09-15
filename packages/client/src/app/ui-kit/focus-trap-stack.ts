// The document's focus traps, topmost last (docs/ui/components-and-constants.md §10.2, `ui-focus-trap`). Traps stack
// (the menu over the results overlay, a confirm over the menu): only the topmost one handles Tab, and a trap
// that goes away hands focus back to what opened it, or into the trap now on top.

import { Injectable } from '@angular/core';

/** What the stack needs from a trap. */
export interface FocusTrap {
  readonly host: HTMLElement;
  /** Moves focus to the trap's autofocus element, else its first focusable element, else its host. */
  focusInitial(): void;
}

/** The elements Tab stops on. A disabled native control is skipped; an `aria-disabled` one is not. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** The Tab stops inside `container`, in document order, leaving out anything hidden or inert. */
export function focusableElementsIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.closest('[hidden], [inert]') === null,
  );
}

@Injectable({ providedIn: 'root' })
export class FocusTrapStack {
  private readonly traps: FocusTrap[] = [];

  push(trap: FocusTrap): void {
    this.remove(trap);
    this.traps.push(trap);
  }

  /** Takes a trap out wherever it sits: a trap under another can close first. */
  remove(trap: FocusTrap): void {
    const index = this.traps.indexOf(trap);
    if (index !== -1) this.traps.splice(index, 1);
  }

  topmost(): FocusTrap | null {
    return this.traps.at(-1) ?? null;
  }

  isTopmost(trap: FocusTrap): boolean {
    return this.topmost() === trap;
  }
}
