// The ladder orbit's callout backings as arc rows (docs/ui/hud.md §3.1.2–§3.1.3, docs/rendering/own-cell-indicators.md §10). Each is
// one of `orbitLayout`'s backings, a span already padded by `LADDER_BACKING_END_PAD_PX` and merged where two
// meet, drawn `LADDER_BACKING_PX` wide with **butt** ends: a round cap would reach half the stroke (8 px) past
// the pad, so the band would overshoot its items by 12 px and two unmerged backings would overlap into a
// darker double seam. Pure.

import { CALLOUT_BACKING, LADDER_BACKING_ALPHA, LADDER_BACKING_PX } from '../constants';
import { DEGREES_PER_TURN } from '../geometry';
import { ARC_CAP, type ArcInstance } from './arc-instance';
import type { OrbitLayout } from './orbit-layout';

export function orbitBackingArcs(
  layout: OrbitLayout,
  centre: { readonly x: number; readonly y: number },
): ArcInstance[] {
  return layout.backings.map((backing) => ({
    x: centre.x,
    y: centre.y,
    radiusPx: layout.radiusPx,
    strokePx: LADDER_BACKING_PX,
    startDeg: backing.startDeg,
    sweep: (backing.endDeg - backing.startDeg) / DEGREES_PER_TURN,
    cap: ARC_CAP.butt,
    colour: CALLOUT_BACKING,
    alpha: LADDER_BACKING_ALPHA,
  }));
}
