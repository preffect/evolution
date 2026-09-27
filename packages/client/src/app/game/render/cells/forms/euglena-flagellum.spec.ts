// @vitest-environment node
// The euglena's leading flagellum (#194, #646; docs/visual-style/motion-and-legibility.md §5.1): a whip out of the
// nose that reaches far past the rings at every speed, never thinner than a limb at its neck, whose wave runs from
// the root to the tip, and whose every drawn point the quad and the preview lens reach.

import { TICK_INTERVAL_S, type CellView } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import {
  PROFILE_WALK_TICKS,
  PROFILE_WALK_TICK_STRIDE,
  PROFILE_WALK_TIMEOUT_MS,
  profileWalkTerms,
  profileWalkView,
} from '../../../../../testing/profile-walk';
import {
  APPENDAGE_MIN_NECK_WIDTH_RADII,
  APPENDAGE_MIN_REACH_PAST_RING_RADII,
  ENGULF_WARNING_RING_RADII,
  EUGLENA_FLAGELLUM_ROOT_INSET_RADII,
  EUGLENA_FLAGELLUM_ROOT_WIDTH_RADII,
  EUGLENA_FLAGELLUM_TIP_WIDTH_RADII,
  RELATION_RING_RADII,
} from '../../constants';
import { cellDrawExtentRadii, restingDrawState } from '../cell-draw-extent';
import { summariseCellTraits } from '../cell-traits';
import { sampleProfileRing } from '../radial-profile';
import type { ShapeTerms } from '../shape-terms';
import {
  EUGLENA_FLAGELLUM_LENGTH_RADII,
  EUGLENA_FLAGELLUM_NECK_SHARE,
  EUGLENA_FLAGELLUM_TIP_CAP_RADII,
  flagellumCentreAt,
  flagellumDrawnReachRadii,
  flagellumTipAt,
  flagellumWidthRadii,
  isOnFlagellum,
  noseRadii,
  type HeadingPoint,
} from './euglena-flagellum';
import { formFor } from './form-profiles';

const BEAT_SAMPLES = 16;
const SPEEDS = [0, 0.25, 0.5, 0.75, 1];
const RING = Math.max(ENGULF_WARNING_RING_RADII, RELATION_RING_RADII);

const euglena = (speedRatio: number, isSprinting = false): CellView =>
  profileWalkView(
    [
      { traitId: 'chloroplast', tier: 1 },
      { traitId: 'euglena_eyespot', tier: 1 },
    ],
    speedRatio,
    isSprinting,
  );

/** Every tip the walk draws at `speedRatio`: each sampled tick at each sampled beat, with the terms it hangs off. */
function eachTip(speedRatio: number, visit: (terms: ShapeTerms, tip: HeadingPoint) => void): void {
  const view = euglena(speedRatio);
  for (let tick = 0; tick <= PROFILE_WALK_TICKS; tick += PROFILE_WALK_TICK_STRIDE * 4) {
    const terms = profileWalkTerms(view, tick * TICK_INTERVAL_S, speedRatio);
    for (let beat = 0; beat < BEAT_SAMPLES; beat += 1)
      visit(terms, flagellumTipAt(noseRadii(terms), beat / BEAT_SAMPLES));
  }
}

describe('the euglena’s flagellum', () => {
  it('leaves the nose straight and swings widest at the tip', () => {
    for (let beat = 0; beat < BEAT_SAMPLES; beat += 1) {
      expect(flagellumCentreAt(0, beat / BEAT_SAMPLES).across).toBeCloseTo(0, 12);
    }
    const swing = Array.from({ length: BEAT_SAMPLES }, (_unused, beat) =>
      Math.abs(flagellumCentreAt(1, beat / BEAT_SAMPLES).across),
    );
    expect(Math.max(...swing)).toBeGreaterThan(0.3);
  });

  it('carries a slope that matches its centre line', () => {
    const step = 1e-6;
    for (const share of [0.05, 0.3, 0.5, 0.8, 0.99]) {
      for (const beat of [0, 0.3, 0.7]) {
        const rise = flagellumCentreAt(share + step, beat).across - flagellumCentreAt(share - step, beat).across;
        const slope = rise / (2 * step * EUGLENA_FLAGELLUM_LENGTH_RADII);
        expect(flagellumCentreAt(share, beat).slope).toBeCloseTo(slope, 6);
      }
    }
  });

  /** A crest at one share moves toward the tip as the beat turns: the wave travels root → tip. */
  it('runs its wave from the root toward the tip', () => {
    const crestAt = (beat: number): number => {
      let best = { share: 0, across: -Infinity };
      for (let index = 0; index <= 200; index += 1) {
        const share = 0.1 + (index / 200) * 0.4;
        const { across } = flagellumCentreAt(share, beat);
        if (across / share > best.across) best = { share, across: across / share };
      }
      return best.share;
    };
    expect(crestAt(0.05)).toBeGreaterThan(crestAt(0));
  });

  /** §5.1 rule 2: at its neck, halfway along the part past the nose, it is a limb, never a hairline. */
  it('is at least the minimum neck width at its neck, tapering root to tip', () => {
    expect(flagellumWidthRadii(EUGLENA_FLAGELLUM_NECK_SHARE)).toBeGreaterThanOrEqual(APPENDAGE_MIN_NECK_WIDTH_RADII);
    expect(flagellumWidthRadii(0)).toBe(EUGLENA_FLAGELLUM_ROOT_WIDTH_RADII);
    expect(flagellumWidthRadii(1)).toBe(EUGLENA_FLAGELLUM_TIP_WIDTH_RADII);
  });

  it('covers its centre line and its round tip, and nothing past its half-width or behind its root', () => {
    const nose = 1.8;
    const beat = 0.2;
    const root = nose - EUGLENA_FLAGELLUM_ROOT_INSET_RADII;
    const share = 0.5;
    const along = root + share * EUGLENA_FLAGELLUM_LENGTH_RADII;
    const centre = flagellumCentreAt(share, beat);
    const squareHalf = (flagellumWidthRadii(share) / 2) * Math.sqrt(1 + centre.slope * centre.slope);
    expect(isOnFlagellum({ along, across: centre.across }, nose, beat)).toBe(true);
    expect(isOnFlagellum({ along, across: centre.across + squareHalf * 0.98 }, nose, beat)).toBe(true);
    expect(isOnFlagellum({ along, across: centre.across + squareHalf * 1.02 }, nose, beat)).toBe(false);
    const tip = flagellumTipAt(nose, beat);
    expect(isOnFlagellum({ ...tip, along: tip.along + EUGLENA_FLAGELLUM_TIP_CAP_RADII * 0.98 }, nose, beat)).toBe(true);
    expect(isOnFlagellum({ ...tip, along: tip.along + EUGLENA_FLAGELLUM_TIP_CAP_RADII * 1.02 }, nose, beat)).toBe(
      false,
    );
    expect(isOnFlagellum({ along: root - 0.01, across: 0 }, nose, beat)).toBe(false);
  });

  /** §5.1 rule 1 at every speed: measured at the tip itself, well past the rings. */
  it(
    'reaches its tip at least the rule’s reach past the rings at every speed and beat',
    () => {
      const misses: string[] = [];
      for (const speedRatio of SPEEDS) {
        eachTip(speedRatio, (_terms, tip) => {
          const reach = Math.hypot(tip.along, tip.across);
          if (reach < RING + APPENDAGE_MIN_REACH_PAST_RING_RADII) misses.push(`speed ${speedRatio}: ${reach}`);
        });
      }
      expect(misses).toEqual([]);
    },
    PROFILE_WALK_TIMEOUT_MS,
  );

  /** §5.1 rule 5: the quad and the preview lens reach the whip's round tip on the widest membrane drawn. */
  it(
    'is reached by the quad and the drawn bound at every speed and beat',
    () => {
      for (const speedRatio of [0, 1]) {
        const { drawnRadii } = cellDrawExtentRadii(
          summariseCellTraits(euglena(speedRatio)),
          restingDrawState(speedRatio),
        );
        eachTip(speedRatio, (terms, tip) => {
          const drawn = Math.hypot(tip.along, tip.across) + EUGLENA_FLAGELLUM_TIP_CAP_RADII;
          expect(drawn, `quad at speed ${speedRatio}`).toBeLessThanOrEqual(terms.maxRadii);
          expect(drawn, `lens at speed ${speedRatio}`).toBeLessThanOrEqual(drawnRadii);
        });
      }
    },
    PROFILE_WALK_TIMEOUT_MS,
  );

  it('adds no reach to any other form', () => {
    for (const traitId of ['paramecium_cilia', 'amoeba_pseudopods', 'diatom_shell', 'stentor_trumpet'] as const) {
      expect(flagellumDrawnReachRadii(formFor(traitId), 2)).toBe(0);
    }
    expect(flagellumDrawnReachRadii(formFor(null), 1)).toBe(0);
    const terms = profileWalkTerms(euglena(0), 0, 0);
    expect(flagellumDrawnReachRadii(formFor('euglena_eyespot'), 1)).toBeGreaterThan(
      Math.max(...sampleProfileRing(terms, 90)) + RING,
    );
  });
});
