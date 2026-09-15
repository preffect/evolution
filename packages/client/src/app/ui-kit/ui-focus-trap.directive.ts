// A modal's focus trap (docs/ui/components-and-constants.md §10.2): Tab and Shift+Tab wrap inside the host, the
// `[uiAutofocus]` element takes focus on open, and focus goes back on destroy. Traps stack through
// `FocusTrapStack`: only the topmost trap wraps Tab, and a destroyed trap restores focus to what opened
// it (or to `restoreTo`) when that is still on the page and not under another open trap, else into the trap
// now on top. Focus the player already moved elsewhere is theirs, and is never taken back.
//
// Focus that leaves the topmost trap on its own (a click on the scrim or on the panel's text drops it on
// `<body>`) is sent back inside, so the next Tab cannot reach the page behind the modal.
//
// It listens on its own host, not the document: `input/keyboard-input.ts` stays the one document handler.

import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, inject, input, type AfterViewInit, type OnDestroy } from '@angular/core';
import { FocusTrapStack, focusableElementsIn, type FocusTrap } from './focus-trap-stack';

function focusedElement(ownerDocument: Document): HTMLElement | null {
  const active = ownerDocument.activeElement;
  return active instanceof HTMLElement && active !== ownerDocument.body ? active : null;
}

@Directive({
  selector: '[uiFocusTrap]',
  standalone: true,
  host: { '(keydown)': 'onKeydown($event)', '(focusout)': 'onFocusout($event)' },
})
export class UiFocusTrapDirective implements FocusTrap, AfterViewInit, OnDestroy {
  /** Where focus goes when the trap closes; by default, the element that had focus when it opened. */
  readonly restoreTo = input<HTMLElement | null>(null);

  readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly stack = inject(FocusTrapStack);
  private readonly document = inject(DOCUMENT);
  private opener: HTMLElement | null = null;
  private autofocusTarget: HTMLElement | null = null;

  /** Called by a `[uiAutofocus]` inside the trap. */
  registerAutofocus(element: HTMLElement | null): void {
    this.autofocusTarget = element;
  }

  ngAfterViewInit(): void {
    this.opener = focusedElement(this.document);
    this.stack.push(this);
    this.focusInitial();
  }

  focusInitial(): void {
    const target = this.autofocusTarget ?? focusableElementsIn(this.host)[0] ?? this.host;
    if (target === this.host && !this.host.hasAttribute('tabindex')) this.host.tabIndex = -1;
    target.focus();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.stack.isTopmost(this)) return;
    const stops = focusableElementsIn(this.host);
    const wrapTo = this.wrapTarget(stops, event.shiftKey);
    // With no stop at all, Tab has nowhere inside to go and must not leave either.
    if (wrapTo === null && stops.length > 0) return;
    event.preventDefault();
    wrapTo?.focus();
  }

  /**
   * Focus left the host: while this trap is on top, bring it back to the element it left (else the trap's
   * initial focus). A move to another element inside the host, or a trap now above this one, keeps it.
   *
   * The pull back waits for a microtask, because the browser applies the new focus *after* this event: focusing
   * from inside the handler would simply be overwritten. A microtask, never a timer — no clock is involved, and
   * it settles within the same task, so nothing observes a frame with focus outside the modal.
   */
  protected onFocusout(event: FocusEvent): void {
    if (!this.stack.isTopmost(this)) return;
    const next = event.relatedTarget;
    if (next instanceof Node && this.host.contains(next)) return;
    const left = event.target instanceof HTMLElement ? event.target : null;
    queueMicrotask(() => this.pullFocusBack(left));
  }

  /** Focus has settled: if it ended outside this trap while it is still the topmost one, take it back. */
  private pullFocusBack(left: HTMLElement | null): void {
    if (!this.stack.isTopmost(this) || !this.host.isConnected) return;
    const active = this.document.activeElement;
    if (active instanceof Node && this.host.contains(active)) return;
    if (left !== null && left.isConnected && this.host.contains(left)) left.focus();
    else this.focusInitial();
  }

  /** Where Tab wraps to: past the last stop (or from outside every stop, the host itself) back round to the other end. */
  private wrapTarget(stops: readonly HTMLElement[], isBackward: boolean): HTMLElement | null {
    const active = focusedElement(this.document);
    const edge = isBackward ? stops[0] : stops.at(-1);
    const otherEnd = isBackward ? stops.at(-1) : stops[0];
    const isOutsideStops = active === null || !stops.includes(active);
    return isOutsideStops || active === edge ? (otherEnd ?? null) : null;
  }

  ngOnDestroy(): void {
    this.stack.remove(this);
    const active = focusedElement(this.document);
    const isFocusLeftBehind = active === null || !active.isConnected || this.host.contains(active);
    if (!isFocusLeftBehind) return;
    const target = this.restoreTo() ?? this.opener;
    const topmost = this.stack.topmost();
    const isTargetReachable =
      target !== null && target.isConnected && (topmost === null || topmost.host.contains(target));
    if (isTargetReachable) target.focus();
    else topmost?.focusInitial();
  }
}

@Directive({
  selector: '[uiAutofocus]',
  standalone: true,
})
export class UiAutofocusDirective implements OnDestroy {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly trap = inject(UiFocusTrapDirective, { optional: true });

  constructor() {
    this.trap?.registerAutofocus(this.element);
  }

  ngOnDestroy(): void {
    this.trap?.registerAutofocus(null);
  }
}
