// @vitest-environment node
// The diatom's spines (#195, #646; docs/visual-style/motion-and-legibility.md §5.1): 8 / 12 / 16 straight spikes round
// the valve that reach far past the rings at every speed, never thinner than a limb at their necks, turn with the
// heading, and whose every drawn point the quad and the preview lens reach.

import { TICK_INTERVAL_S, type CellView, type TraitId } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import {
  PROFILE_WALK_RING_SAMPLES,
  PROFILE_WALK_TICKS,
  PROFILE_WALK_TICK_STRIDE,
  PROFILE_WALK_TIMEOUT_MS,
  profileWalkTerms,
  profileWalkView,
} from '../../../../../testing/profile-walk';
import {
  APPENDAGE_MIN_NECK_WIDTH_RADII,
  APPENDAGE_MIN_REACH_PAST_RING_RADII,
  DIATOM_SPINE_ROOT_INSET_RADII,
  DIATOM_SPINE_ROOT_WIDTH_RADII,
  DIATOM_SPINE_TIP_GLOW_RADII,
  DIATOM_SPINE_TIP_WIDTH_RADII,
  ENGULF_WARNING_RING_RADII,
  RELATION_RING_RADII,
} from '../../constants';
import { cellDrawExtentRadii, restingDrawState } from '../cell-draw-extent';
import { summariseCellTraits } from '../cell-traits';
import { sampleProfileRing } from '../radial-profile';
import {
  DIATOM_SPINE_LENGTH_RADII,
  DIATOM_SPINE_NECK_SHARE,
  DIATOM_SPINE_TIP_CAP_RADII,
  diatomSpineCount,
  isOnSpine,
  spineAngle,
  spineDrawnReachRadii,
  spineTipRadii,
  spineWidthRadii,
} from './diatom-spines';
import { formFor } from './form-profiles';

const SPEEDS = [0, 0.5, 1];
const RING = Math.max(ENGULF_WARNING_RING_RADII, RELATION_RING_RADII);
const DIATOM = formFor('diatom_shell');

const diatom = (speedRatio: number, isSprinting = false): CellView =>
  profileWalkView(
    [
      { traitId: 'cell_wall', tier: 1 },
      { traitId: 'diatom_shell', tier: 3 },
    ],
    speedRatio,
    isSprinting,
  );

/** The membrane at its narrowest and widest over the walk at `speedRatio`, sprinting or not. */
function membraneRange(speedRatio: number, isSprinting: boolean): { readonly narrowest: number; widest: number } {
  const view = diatom(speedRatio, isSprinting);
  let narrowest = Infinity;
  let widest = 0;
  for (let tick = 0; tick <= PROFILE_WALK_TICKS; tick += PROFILE_WALK_TICK_STRIDE) {
    const ring = sampleProfileRing(
      profileWalkTerms(view, tick * TICK_INTERVAL_S, speedRatio),
      PROFILE_WALK_RING_SAMPLES,
    );
    narrowest = Math.min(narrowest, ...ring);
    widest = Math.max(widest, ...ring);
  }
  return { narrowest, widest };
}

describe('the diatom’s spines', () => {
  it('number 8 / 12 / 16 by tier on a diatom and none on any other form', () => {
    expect([1, 2, 3].map((tier) => diatomSpineCount(DIATOM, tier as 1 | 2 | 3))).toEqual([8, 12, 16]);
    const others: (TraitId | null)[] = [null, 'amoeba_pseudopods', 'paramecium_cilia', 'euglena_eyespot'];
    for (const traitId of others) expect(diatomSpineCount(formFor(traitId), 3)).toBe(0);
  });

  it('sit evenly round the valve, the first on the heading, and turn with it', () => {
    expect(spineAngle(0, 8, 0.7)).toBe(0.7);
    expect(spineAngle(2, 8, 0)).toBeCloseTo(Math.PI / 2, 12);
    expect(spineAngle(3, 12, 1) - spineAngle(2, 12, 1)).toBeCloseTo(Math.PI / 6, 12);
  });

  /** §5.1 rule 2: at its neck, halfway along the part past the membrane, a spine is a limb, never a hairline. */
  it('is at least the minimum neck width at its neck, tapering root to tip', () => {
    expect(spineWidthRadii(DIATOM_SPINE_NECK_SHARE)).toBeGreaterThanOrEqual(APPENDAGE_MIN_NECK_WIDTH_RADII);
    expect(spineWidthRadii(0)).toBe(DIATOM_SPINE_ROOT_WIDTH_RADII);
    expect(spineWidthRadii(1)).toBe(DIATOM_SPINE_TIP_WIDTH_RADII);
  });

  it('covers its axis and its round tip, and nothing past its half-width or behind its root', () => {
    const membrane = 1;
    const angle = 0.4;
    const pointAt = (along: number, across: number) => ({
      x: along * Math.cos(angle) - across * Math.sin(angle),
      y: along * Math.sin(angle) + across * Math.cos(angle),
    });
    const root = membrane - DIATOM_SPINE_ROOT_INSET_RADII;
    const half = spineWidthRadii(0.5) / 2;
    const middle = root + 0.5 * DIATOM_SPINE_LENGTH_RADII;
    expect(isOnSpine(pointAt(middle, 0), angle, membrane)).toBe(true);
    expect(isOnSpine(pointAt(middle, half * 0.98), angle, membrane)).toBe(true);
    expect(isOnSpine(pointAt(middle, -half * 1.02), angle, membrane)).toBe(false);
    const tip = spineTipRadii(membrane);
    expect(isOnSpine(pointAt(tip + DIATOM_SPINE_TIP_CAP_RADII * 0.98, 0), angle, membrane)).toBe(true);
    expect(isOnSpine(pointAt(tip + DIATOM_SPINE_TIP_CAP_RADII * 1.02, 0), angle, membrane)).toBe(false);
    expect(isOnSpine(pointAt(root - 0.01, 0), angle, membrane)).toBe(false);
  });

  /**
   * §5.1 rule 1 at every speed and in a sprint: the valve is rigid and the spines never retract, so the tip over the
   * narrowest membrane drawn is still well past the rings.
   */
  it(
    'reaches its tip at least the rule’s reach past the rings at every speed, sprinting or not',
    () => {
      for (const speedRatio of SPEEDS) {
        for (const isSprinting of [false, true]) {
          const { narrowest } = membraneRange(speedRatio, isSprinting);
          expect(spineTipRadii(narrowest), `speed ${speedRatio}`).toBeGreaterThanOrEqual(
            RING + APPENDAGE_MIN_REACH_PAST_RING_RADII,
          );
        }
      }
    },
    PROFILE_WALK_TIMEOUT_MS,
  );

  /** §5.1 rule 5: the quad and the preview lens reach a spine's tip glow on the widest membrane drawn. */
  it(
    'is reached by the quad and the drawn bound at every speed',
    () => {
      for (const speedRatio of SPEEDS) {
        const { widest } = membraneRange(speedRatio, false);
        const drawn = spineTipRadii(widest) + Math.max(DIATOM_SPINE_TIP_CAP_RADII, DIATOM_SPINE_TIP_GLOW_RADII);
        const { drawnRadii } = cellDrawExtentRadii(
          summariseCellTraits(diatom(speedRatio)),
          restingDrawState(speedRatio),
        );
        const terms = profileWalkTerms(diatom(speedRatio), 0, speedRatio);
        expect(drawn, `quad at speed ${speedRatio}`).toBeLessThanOrEqual(terms.maxRadii);
        expect(drawn, `lens at speed ${speedRatio}`).toBeLessThanOrEqual(drawnRadii);
      }
    },
    PROFILE_WALK_TIMEOUT_MS,
  );

  it('adds no reach to any other form', () => {
    for (const traitId of ['paramecium_cilia', 'amoeba_pseudopods', 'euglena_eyespot', 'stentor_trumpet'] as const) {
      expect(spineDrawnReachRadii(formFor(traitId), 2)).toBe(0);
    }
    expect(spineDrawnReachRadii(formFor(null), 1)).toBe(0);
    expect(spineDrawnReachRadii(DIATOM, 1)).toBe(spineTipRadii(1) + DIATOM_SPINE_TIP_GLOW_RADII);
  });
});
