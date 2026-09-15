// A surface's one DOM measurement (docs/ui/layout.md §1): the host's box, now and whenever it changes.
// Thin by design so `ui-surface.directive.ts` and `hud.component.ts` hold no observer wiring and every scale
// rule stays in the pure `uiScaleFor`. A host without `ResizeObserver` (a unit-test DOM) still gets the first read.

import { DestroyRef, inject, signal } from '@angular/core';

export interface ElementSize {
  readonly widthPx: number;
  readonly heightPx: number;
}

export type ElementSizeListener = (size: ElementSize) => void;

/** The box before the first read: a detached host has no layout, and `uiScaleFor` answers its floor for it. */
export const NO_ELEMENT_SIZE: ElementSize = { widthPx: 0, heightPx: 0 };

function sizeOf(element: Element): ElementSize {
  const box = element.getBoundingClientRect();
  return { widthPx: box.width, heightPx: box.height };
}

/**
 * Reports `element`'s box immediately and on every resize. Returns the teardown; calling it stops
 * the observer, and calling it twice is safe.
 */
export function observeElementSize(element: Element, onSize: ElementSizeListener): () => void {
  onSize(sizeOf(element));
  if (typeof ResizeObserver === 'undefined') return () => undefined;
  const observer = new ResizeObserver(() => onSize(sizeOf(element)));
  observer.observe(element);
  return () => observer.disconnect();
}

/**
 * A host's box as a signal, for a full-viewport layer. Construct it in an injection context (a field
 * initialiser): it stops observing when that context is destroyed. Call `start()` from the host's first
 * lifecycle hook, once its box can be read; a second call is a no-op.
 */
export class ElementSizeTracker {
  private readonly element: Element;
  private readonly sizeSignal = signal<ElementSize>(NO_ELEMENT_SIZE);
  private stopObserving: (() => void) | null = null;

  readonly size = this.sizeSignal.asReadonly();

  constructor(element: Element) {
    this.element = element;
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  start(): void {
    if (this.stopObserving !== null) return;
    this.stopObserving = observeElementSize(this.element, (size) => this.sizeSignal.set(size));
  }

  private stop(): void {
    this.stopObserving?.();
    this.stopObserving = null;
  }
}
