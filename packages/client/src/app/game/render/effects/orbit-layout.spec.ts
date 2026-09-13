import { describe, expect, it } from 'vitest';
import { ENDOSYMBIOSIS_BACTERIA_REQUIRED, RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { createTestAerobicCounter, createTestPhotosyntheticCounter } from '../../../../testing/ladder-counters';
import {
  LADDER_BACKING_END_PAD_PX,
  LADDER_GHOST_PX,
  LADDER_ITEM_CLEARANCE_PX,
  LADDER_ITEM_GAP_PX,
  LADDER_ORBIT_ANGLES_PAIR_DEG,
  LADDER_ORBIT_ANGLE_SINGLE_DEG,
} from '../constants';
import { DEGREES_PER_TURN, HALF } from '../geometry';
import { LADDER_SILHOUETTE, type Ladder, type LadderCounter } from '../../state/own-cell-indicators';
import { counterLengthPx, orbitLayout, pipBlockSizePx, type OrbitArc, type OrbitLayout } from './orbit-layout';
import { ladderOrbitRadiusPx, orbitDegreesOf } from './own-cell-indicators';

const REQUIRED = ENDOSYMBIOSIS_BACTERIA_REQUIRED;
/** UI.md §3.1.3's four sizes (its table, pinned in `own-cell-indicators.spec.ts`). */
const TABLE_SIZES_PX = [24, 32, 45, 102] as const;
const FLOAT_SLACK = 1e-9;
const AEROBIC = createTestAerobicCounter();
const PHOTOSYNTHETIC = createTestPhotosyntheticCounter();
const BOTH_COUNTERS: Ladder = { ghost: null, counters: [AEROBIC, PHOTOSYNTHETIC] };
const ENVELOPE_GHOST = { silhouette: LADDER_SILHOUETTE.envelope, angleDeg: LADDER_ORBIT_ANGLE_SINGLE_DEG };

function centreOf(arc: OrbitArc | undefined): number {
  if (arc === undefined) throw new Error('expected an orbit arc');
  return (arc.startDeg + arc.endDeg) * HALF;
}

/** The px between the two spans of a layout, negative when they overlap. */
function spanGapPx(layout: OrbitLayout): number {
  const [first, second] = [...layout.spans].sort((one, other) => one.startDeg - other.startDeg);
  if (first === undefined || second === undefined) throw new Error('expected two spans');
  return ((second.startDeg - first.endDeg) / DEGREES_PER_TURN) * RADIANS_PER_FULL_TURN * layout.radiusPx;
}

describe('orbitLayout', () => {
  it('measures a counter as its ghost, the item gap and a pip block of two rows of five', () => {
    expect(pipBlockSizePx(REQUIRED)).toEqual({ width: 32, height: 11 });
    expect(counterLengthPx(REQUIRED)).toBe(LADDER_GHOST_PX + LADDER_ITEM_GAP_PX + 32);
    expect(pipBlockSizePx(0)).toEqual({ width: 0, height: 0 });
  });

  it('lays a lone rung ghost centred on 6 o’clock over a backing padded at both ends', () => {
    const rPx = 45;
    const nucleoid = { ...ENVELOPE_GHOST, silhouette: LADDER_SILHOUETTE.nucleoid };
    const layout = orbitLayout({ ghost: nucleoid, counters: [] }, rPx);
    expect(layout.ghosts).toHaveLength(1);
    expect(layout.ghosts[0]).toMatchObject({ key: LADDER_SILHOUETTE.nucleoid, hasUnlockRing: false });
    expect(layout.ghosts[0]?.x).toBeCloseTo(0);
    expect(layout.ghosts[0]?.y).toBeCloseTo(ladderOrbitRadiusPx(rPx));
    const halfDeg = orbitDegreesOf(LADDER_GHOST_PX * HALF + LADDER_BACKING_END_PAD_PX, layout.radiusPx);
    expect(layout.backings).toHaveLength(1);
    expect(layout.backings[0]?.startDeg).toBeCloseTo(LADDER_ORBIT_ANGLE_SINGLE_DEG - halfDeg);
    expect(layout.backings[0]?.endDeg).toBeCloseTo(LADDER_ORBIT_ANGLE_SINGLE_DEG + halfDeg);
    expect(layout.pipBlocks).toEqual([]);
  });

  it('centres each counter on its angle, its ghost first and its pips after, clockwise', () => {
    const layout = orbitLayout(BOTH_COUNTERS, 45);
    BOTH_COUNTERS.counters.forEach((expected, index) => {
      const span = layout.spans[index];
      expect(centreOf(span)).toBeCloseTo(expected.angleDeg);
      const ghostOffsetDeg = orbitDegreesOf(LADDER_GHOST_PX * HALF, layout.radiusPx);
      expect(layout.ghosts[index]?.angleDeg).toBeCloseTo((span?.startDeg ?? Number.NaN) + ghostOffsetDeg);
      expect(layout.pipBlocks[index]?.angleDeg).toBeGreaterThan(layout.ghosts[index]?.angleDeg ?? Number.NaN);
      expect(layout.pipBlocks[index]).toMatchObject({ variant: expected.variant, required: REQUIRED });
    });
  });

  it('keeps a previewed counter’s pips where they were when its ghost hides', () => {
    const shown = orbitLayout({ ghost: null, counters: [AEROBIC] }, 32);
    const hidden = orbitLayout({ ghost: null, counters: [createTestAerobicCounter({ isGhostHidden: true })] }, 32);
    expect(hidden.ghosts).toEqual([]);
    expect(hidden.pipBlocks).toEqual(shown.pipBlocks);
    expect(hidden.backings).toEqual(shown.backings);
  });

  it('rings only an unlocked counter’s ghost', () => {
    const unlocked = createTestAerobicCounter({ isUnlocked: true });
    const layout = orbitLayout({ ghost: null, counters: [unlocked, PHOTOSYNTHETIC] }, 45);
    expect(layout.ghosts.map((ghost) => ghost.hasUnlockRing)).toEqual([true, false]);
  });

  it('never hands the drawing more pips than the block has, whatever the record says', () => {
    const overflowing = createTestAerobicCounter({ eaten: REQUIRED + 2 });
    expect(orbitLayout({ ghost: null, counters: [overflowing] }, 45).pipBlocks[0]?.eaten).toBe(REQUIRED);
  });

  it('draws nothing for an empty ladder', () => {
    const layout = orbitLayout({ ghost: null, counters: [] }, 45);
    expect(layout).toMatchObject({ spans: [], backings: [], ghosts: [], pipBlocks: [] });
  });
});

describe('a rung ghost beside a counter (decision #285 B)', () => {
  const beside = (remaining: LadderCounter, rPx: number): OrbitLayout =>
    orbitLayout({ ghost: ENVELOPE_GHOST, counters: [remaining] }, rPx);
  /** The ghost's group is laid first, so the counter's span is the second. */
  const counterCentreOf = (layout: OrbitLayout): number => centreOf(layout.spans[1]);

  it.each(TABLE_SIZES_PX)(
    'keeps either remaining counter at least the item clearance from the ghost at %s px',
    (rPx) => {
      expect(spanGapPx(beside(AEROBIC, rPx))).toBeGreaterThanOrEqual(LADDER_ITEM_CLEARANCE_PX - FLOAT_SLACK);
      expect(spanGapPx(beside(PHOTOSYNTHETIC, rPx))).toBeGreaterThanOrEqual(LADDER_ITEM_CLEARANCE_PX - FLOAT_SLACK);
    },
  );

  it('turns a crowding counter away from the fixed ghost, aerobic clockwise and photosynthetic counter-clockwise', () => {
    const aerobic = beside(AEROBIC, 24);
    expect(aerobic.ghosts[0]?.angleDeg).toBe(LADDER_ORBIT_ANGLE_SINGLE_DEG);
    expect(counterCentreOf(aerobic)).toBeGreaterThan(LADDER_ORBIT_ANGLES_PAIR_DEG.aerobic);
    const photosynthetic = beside(PHOTOSYNTHETIC, 24);
    expect(photosynthetic.ghosts[0]?.angleDeg).toBe(LADDER_ORBIT_ANGLE_SINGLE_DEG);
    expect(counterCentreOf(photosynthetic)).toBeLessThan(LADDER_ORBIT_ANGLES_PAIR_DEG.photosynthetic);
  });

  it('turns it only as far as the clearance needs: exactly that clear, not further', () => {
    expect(spanGapPx(beside(AEROBIC, 24))).toBeCloseTo(LADDER_ITEM_CLEARANCE_PX);
    expect(spanGapPx(beside(PHOTOSYNTHETIC, 24))).toBeCloseTo(LADDER_ITEM_CLEARANCE_PX);
  });

  it('turns a counter only below 31 px, as §3.1.3 says, and never when no ghost shares the orbit', () => {
    expect(counterCentreOf(beside(AEROBIC, 30))).toBeGreaterThan(LADDER_ORBIT_ANGLES_PAIR_DEG.aerobic);
    expect(counterCentreOf(beside(AEROBIC, 31))).toBeCloseTo(LADDER_ORBIT_ANGLES_PAIR_DEG.aerobic);
    expect(counterCentreOf(beside(AEROBIC, 45))).toBeCloseTo(LADDER_ORBIT_ANGLES_PAIR_DEG.aerobic);
    const alone = orbitLayout(BOTH_COUNTERS, 24);
    BOTH_COUNTERS.counters.forEach((expected, index) => {
      expect(centreOf(alone.spans[index])).toBeCloseTo(expected.angleDeg);
    });
  });

  it('merges the two backings into one band where their pads meet, and keeps them apart where not', () => {
    expect(beside(AEROBIC, 24).backings).toHaveLength(1);
    expect(beside(AEROBIC, 32).backings).toHaveLength(1);
    expect(beside(AEROBIC, 45).backings).toHaveLength(2);
  });
});
