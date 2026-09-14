// The backings as drawn (graphics-qa round one on #303): a round cap reaches half the 16 px stroke past the
// pad, so the band overshot its items by 12 px and the prokaryote's two backings, 5 px apart at 24 px
// (UI.md §3.1.3), overlapped into a double-alpha seam. These pin the drawn extents, caps included, at the
// table's four sizes: a round cap would fail both.
import { describe, expect, it } from 'vitest';
import { createTestAerobicCounter, createTestPhotosyntheticCounter } from '../../../../testing/ladder-builders';
import { LADDER_BACKING_END_PAD_PX, LADDER_BACKING_PX, LADDER_ORBIT_ANGLE_SINGLE_DEG } from '../constants';
import { DEGREES_PER_TURN } from '../geometry';
import { LADDER_SILHOUETTE, type Ladder } from '../../state/own-cell-indicators';
import { ARC_CAP, type ArcInstance } from './arc-instance';
import { orbitBackingArcs } from './orbit-backing-arcs';
import { orbitLayout } from './orbit-layout';
import { orbitDegreesOf } from './own-cell-geometry';

/** UI.md §3.1.3's geometry table rows. */
const TABLE_SIZES_PX = [24, 32, 45, 102];
const CENTRE = { x: 0, y: 0 };
const FLOAT_SLACK_DEG = 1e-9;
const PROKARYOTE: Ladder = {
  ghost: null,
  counters: [createTestAerobicCounter(), createTestPhotosyntheticCounter()],
};
const GHOST_BESIDE_COUNTERS: Ladder = {
  ghost: { silhouette: LADDER_SILHOUETTE.envelope, angleDeg: LADDER_ORBIT_ANGLE_SINGLE_DEG },
  counters: PROKARYOTE.counters,
};

/** How far the drawn stroke reaches past the end angle: half the stroke for a round cap, nothing for a butt end. */
function capReachPx(arc: ArcInstance): number {
  return arc.cap === ARC_CAP.round ? arc.strokePx / 2 : 0;
}

/** Where the stroke is actually drawn, in degrees clockwise from 12 o'clock, caps included. */
function drawnExtentDeg(arc: ArcInstance): { readonly start: number; readonly end: number } {
  const capDeg = orbitDegreesOf(capReachPx(arc), arc.radiusPx);
  return { start: arc.startDeg - capDeg, end: arc.startDeg + arc.sweep * DEGREES_PER_TURN + capDeg };
}

describe('orbitBackingArcs', () => {
  it.each(TABLE_SIZES_PX)('never overlaps the prokaryote’s two unmerged backings at %i px, caps included', (rPx) => {
    const rows = orbitBackingArcs(orbitLayout(PROKARYOTE, rPx), CENTRE);
    expect(rows).toHaveLength(2);
    const [first, second] = rows.map(drawnExtentDeg).sort((left, right) => left.start - right.start);
    expect(first!.end).toBeLessThanOrEqual(second!.start + FLOAT_SLACK_DEG);
    expect(second!.end - DEGREES_PER_TURN).toBeLessThanOrEqual(first!.start + FLOAT_SLACK_DEG);
  });

  it.each(TABLE_SIZES_PX)('ends every backing exactly LADDER_BACKING_END_PAD_PX past its items at %i px', (rPx) => {
    for (const ladder of [PROKARYOTE, GHOST_BESIDE_COUNTERS]) {
      const layout = orbitLayout(ladder, rPx);
      const padDeg = orbitDegreesOf(LADDER_BACKING_END_PAD_PX, layout.radiusPx);
      for (const row of orbitBackingArcs(layout, CENTRE)) {
        const drawn = drawnExtentDeg(row);
        const covered = layout.spans.filter(
          (span) => span.startDeg >= drawn.start - FLOAT_SLACK_DEG && span.endDeg <= drawn.end + FLOAT_SLACK_DEG,
        );
        expect(covered.length).toBeGreaterThan(0);
        expect(drawn.start).toBeCloseTo(Math.min(...covered.map((span) => span.startDeg)) - padDeg, 9);
        expect(drawn.end).toBeCloseTo(Math.max(...covered.map((span) => span.endDeg)) + padDeg, 9);
        expect(row.strokePx).toBe(LADDER_BACKING_PX);
        expect(row.cap).toBe(ARC_CAP.butt);
      }
    }
  });
});
