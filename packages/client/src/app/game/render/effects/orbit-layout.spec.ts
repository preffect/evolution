import { describe, expect, it } from 'vitest';
import { ENDOSYMBIOSIS_BACTERIA_REQUIRED } from '@evolution/shared';
import { createTestAerobicCounter, createTestPhotosyntheticCounter } from '../../../../testing/ladder-counters';
import {
  LADDER_BACKING_END_PAD_PX,
  LADDER_GHOST_PX,
  LADDER_ITEM_CLEARANCE_PX,
  LADDER_ITEM_GAP_PX,
  LADDER_ORBIT_ANGLES_PAIR_DEG,
  LADDER_ORBIT_ANGLE_SINGLE_DEG,
} from '../constants';
import { HALF } from '../geometry';
import { LADDER_SILHOUETTE, type Ladder, type LadderCounter } from '../../state/own-cell-indicators';
import {
  counterLengthPx,
  ghostBoxOf,
  orbitLayout,
  pipBlockBoxOf,
  pipBlockSizePx,
  type OrbitArc,
  type OrbitLayout,
} from './orbit-layout';
import { orientedBoxGapPx } from './oriented-box';
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

interface DrawnGaps {
  /** The rung ghost's box to the counter's ghost box. */
  readonly ghostToGhost: number;
  /** The rung ghost's box to the counter's pip block box. */
  readonly pipsToGhost: number;
}

/**
 * The gaps between the boxes as drawn, each laid tangent to the orbit: what the player sees, and what
 * an arc-length gap overstates, since a tangent box's inner corners reach past its arc angle.
 */
function drawnGapsPx(layout: OrbitLayout): DrawnGaps {
  const [rungGhost, counterGhost] = layout.ghosts;
  const [pipBlock] = layout.pipBlocks;
  if (rungGhost === undefined || counterGhost === undefined || pipBlock === undefined) {
    throw new Error('expected a rung ghost beside a counter');
  }
  const rungBox = ghostBoxOf(rungGhost);
  return {
    ghostToGhost: orientedBoxGapPx(rungBox, ghostBoxOf(counterGhost)),
    pipsToGhost: orientedBoxGapPx(rungBox, pipBlockBoxOf(pipBlock)),
  };
}

function nearestDrawnGapPx(layout: OrbitLayout): number {
  const gaps = drawnGapsPx(layout);
  return Math.min(gaps.ghostToGhost, gaps.pipsToGhost);
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
    'keeps the drawn boxes the item clearance apart at %s px, ghost to ghost and pips to ghost',
    (rPx) => {
      for (const remaining of [AEROBIC, PHOTOSYNTHETIC]) {
        const gaps = drawnGapsPx(beside(remaining, rPx));
        expect(gaps.ghostToGhost, `${remaining.variant} ghost`).toBeGreaterThanOrEqual(
          LADDER_ITEM_CLEARANCE_PX - FLOAT_SLACK,
        );
        expect(gaps.pipsToGhost, `${remaining.variant} pips`).toBeGreaterThanOrEqual(
          LADDER_ITEM_CLEARANCE_PX - FLOAT_SLACK,
        );
      }
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

  it.each([24, 32])('turns it only as far as the drawn clearance needs at %s px: exactly that far apart', (rPx) => {
    // Aerobic's nearer box is its ghost, photosynthetic's its pip block (it runs clockwise into the ghost).
    expect(drawnGapsPx(beside(AEROBIC, rPx)).ghostToGhost).toBeCloseTo(LADDER_ITEM_CLEARANCE_PX);
    expect(drawnGapsPx(beside(PHOTOSYNTHETIC, rPx)).pipsToGhost).toBeCloseTo(LADDER_ITEM_CLEARANCE_PX);
    expect(nearestDrawnGapPx(beside(AEROBIC, rPx))).toBeCloseTo(LADDER_ITEM_CLEARANCE_PX);
  });

  it('turns counters at 32 px and not from 34 px up, as §3.1.3 says, and never with no ghost on the orbit', () => {
    expect(counterCentreOf(beside(AEROBIC, 32))).toBeGreaterThan(LADDER_ORBIT_ANGLES_PAIR_DEG.aerobic);
    expect(counterCentreOf(beside(PHOTOSYNTHETIC, 32))).toBeLessThan(LADDER_ORBIT_ANGLES_PAIR_DEG.photosynthetic);
    for (const rPx of [34, 45]) {
      expect(counterCentreOf(beside(AEROBIC, rPx))).toBeCloseTo(LADDER_ORBIT_ANGLES_PAIR_DEG.aerobic);
      expect(counterCentreOf(beside(PHOTOSYNTHETIC, rPx))).toBeCloseTo(LADDER_ORBIT_ANGLES_PAIR_DEG.photosynthetic);
    }
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
