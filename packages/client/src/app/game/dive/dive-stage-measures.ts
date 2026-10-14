// What the dive panel measures on its stage (docs/rendering/opening-dive.md §2, §5; ticket #805): the stage's own size
// for the canvases, the readout's box for the labels' keep-out, and each label's box as rendered. Each is read when it
// changes size, through the page's own `ResizeObserver`; a unit-test DOM has none, and the dive falls back to its
// constants and estimates.

import { DIVE_READOUT_CLEARANCE_PX } from '../render/constants';
import type { DiveReadoutKeepOut } from '../render/dive/dive-labels';

/** Runs `onResize` whenever one of `elements` changes size. Answers the teardown; a no-op where there is no observer. */
export function observeSizes(elements: readonly Element[], onResize: () => void): () => void {
  const view = elements[0]?.ownerDocument.defaultView;
  if (view === null || view === undefined || typeof view.ResizeObserver !== 'function') return () => undefined;
  const observer = new view.ResizeObserver(() => onResize());
  for (const element of elements) observer.observe(element);
  return () => observer.disconnect();
}

/** The readout's box on its stage, and the clearance a label keeps past it. */
export function diveReadoutKeepOut(readout: HTMLElement): DiveReadoutKeepOut {
  return {
    right: readout.offsetLeft + readout.offsetWidth + DIVE_READOUT_CLEARANCE_PX,
    bottom: readout.offsetTop + readout.offsetHeight + DIVE_READOUT_CLEARANCE_PX,
  };
}

/** Each label's backing box as rendered, by its text; one not laid out yet (no width) is left to the estimate. */
export function measuredLabelWidths(labels: readonly HTMLElement[]): ReadonlyMap<string, number> {
  const widths = new Map<string, number>();
  for (const label of labels) {
    const text = label.textContent ?? '';
    if (label.offsetWidth > 0) widths.set(text, label.offsetWidth);
  }
  return widths;
}
