// A surface's one DOM measurement (docs/ui/layout.md §1): the host's box, now and whenever it changes.
// Thin by design so `ui-surface.directive.ts` and `hud.component.ts` hold no observer wiring and every scale
// rule stays in the pure `uiScaleFor`. A host without `ResizeObserver` (a unit-test DOM) still gets the first read.

export interface ElementSize {
  readonly widthPx: number;
  readonly heightPx: number;
}

export type ElementSizeListener = (size: ElementSize) => void;

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
