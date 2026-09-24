// The amoeba's lobes in the shape terms (#192, docs/rendering/cells.md §2.1): the frame's pseudopods appended after the
// deformation's bumps, aimed along the heading or round the engulfed prey, and the core's reach.

import { describe, expect, it } from 'vitest';
import { CELL_STAGE, createSeededRandom, type TraitId } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { CELL_QUAD_EXTENT_RADII, MAX_SHAPE_BUMPS, PSEUDOPOD_ENGULF_LEAN } from '../constants';
import { buildNoiseStrip } from '../noise/noise-strip';
import { REST_DEFORMATION } from './cell-deformation';
import { summariseCellTraits } from './cell-traits';
import { pseudopodBumps } from './forms/amoeba-pseudopods';
import type { ShapeBump } from './radial-profile';
import { buildShapeTerms } from './shape-terms';

const TEST_SEED = 42;

const activeSlots = (bumps: readonly { amplitude: number }[]) => bumps.filter((slot) => slot.amplitude !== 0).length;

const withTraits = (traits: { traitId: TraitId; tier: 1 | 2 | 3 }[], stage = CELL_STAGE.specialised) => {
  const view = createTestCellView({ radius: 40, stage, traits });
  return {
    view,
    traits: summariseCellTraits(view),
    timeSeconds: 0,
    speedRatio: 0,
    heading: 0,
    phase: 0,
    stripRow: 0,
    strip: buildNoiseStrip(createSeededRandom(TEST_SEED)),
    deformation: REST_DEFORMATION,
  };
};

describe('the amoeba’s pseudopods (#192)', () => {
  const amoeba = (tier: 1 | 2 | 3) => withTraits([{ traitId: 'amoeba_pseudopods', tier }], CELL_STAGE.specialised);
  const bump = (centre: number) => ({ amplitude: 0.3, centre, sigma: 0.3 });

  it('fills 2 / 3 / 4 slots with the frame’s lobes and shrinks the core', () => {
    for (const [tier, count] of [
      [1, 2],
      [2, 3],
      [3, 4],
    ] as const) {
      const base = { ...amoeba(tier), timeSeconds: 1.3, phase: 0.2, speedRatio: 0.5, heading: 0.7 };
      const terms = buildShapeTerms(base);
      const lobes = pseudopodBumps({ count, timeSeconds: 1.3, phase: 0.2, aim: 0.7, lean: 0.5 });
      expect(terms.bumps.slice(0, count)).toEqual(lobes);
      expect(activeSlots(terms.bumps)).toBe(count);
      expect(terms.form?.peak).toBeLessThan(1);
    }
  });

  it('keeps the deformation’s bumps in the first slots and cuts only what the lobes reserve', () => {
    const engulf = [bump(0.1), bump(0.2), bump(0.3), bump(0.4), bump(0.5)];
    const terms = buildShapeTerms({ ...amoeba(3), deformation: { ...REST_DEFORMATION, bumps: engulf } });
    expect(terms.bumps.slice(0, 4)).toEqual(engulf.slice(0, 4));
    expect(terms.bumps).not.toContain(engulf[4]);
    expect(activeSlots(terms.bumps)).toBe(MAX_SHAPE_BUMPS);
    const blob = buildShapeTerms({ ...withTraits([]), deformation: { ...REST_DEFORMATION, bumps: engulf } });
    expect(blob.bumps.slice(0, 5)).toEqual(engulf);
  });

  /** Two aims, two cases: the heading when nothing is caught, the prey while engulfing. */
  it('reaches the lobes round the engulfed prey even when slow, and otherwise along the heading at its speed', () => {
    const count = 4;
    const lobesOf = (terms: { bumps: readonly ShapeBump[] }) => terms.bumps.slice(0, count);
    const moment = { timeSeconds: 0.8, phase: 0.1 };
    const swimming = buildShapeTerms({ ...amoeba(3), ...moment, heading: 1, speedRatio: 0.2 });
    expect(lobesOf(swimming)).toEqual(pseudopodBumps({ count, ...moment, aim: 1, lean: 0.2 }));
    const engulfing = buildShapeTerms({
      ...amoeba(3),
      ...moment,
      heading: 1,
      speedRatio: 0.2,
      deformation: { ...REST_DEFORMATION, preyAngle: -2 },
    });
    expect(lobesOf(engulfing)).toEqual(pseudopodBumps({ count, ...moment, aim: -2, lean: PSEUDOPOD_ENGULF_LEAN }));
  });

  it('draws no lobes on any other form', () => {
    const slipper = buildShapeTerms(withTraits([{ traitId: 'paramecium_cilia', tier: 3 }], CELL_STAGE.specialised));
    expect(activeSlots(slipper.bumps)).toBe(0);
  });

  it('reaches past the blob by its lobes, under the quad floor', () => {
    const terms = buildShapeTerms({ ...amoeba(1), speedRatio: 1 });
    expect(terms.maxRadii).toBeGreaterThan(buildShapeTerms(withTraits([])).maxRadii);
    expect(terms.maxRadii).toBeLessThan(CELL_QUAD_EXTENT_RADII);
  });
});
