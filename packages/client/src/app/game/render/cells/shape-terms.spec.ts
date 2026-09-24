// docs/rendering/files-and-tests.md §9: view → terms, the eight bump slots, sprint scaling, the held heading and
// the per-instance reach under CELL_QUAD_EXTENT_RADII.

import { describe, expect, it } from 'vitest';
import { CELL_STAGE, createSeededRandom, type CellStage, type TraitId } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import {
  BREATH_AMPLITUDE,
  CELL_QUAD_EXTENT_RADII,
  FORM_WOBBLE_MODE,
  HALO_OUTER_RADII,
  JITTER_AMPLITUDE,
  MAX_SHAPE_BUMPS,
  PROTOCELL_HALO_OUTER_RADII,
  PROTOCELL_WOBBLE_MODE,
  SPRINT_STRETCH_SCALE,
  STRETCH_ALONG,
  TRAIT_HALO_OUTER_RADII,
  WOBBLE_TAUT_SCALE,
} from '../constants';
import { degreesToRadians } from '../geometry';
import { buildNoiseStrip } from '../noise/noise-strip';
import { REST_DEFORMATION } from './cell-deformation';
import { summariseCellTraits } from './cell-traits';
import { ZERO_BUMP } from './radial-profile';
import { pseudopodBumps } from './forms/amoeba-pseudopods';
import { assignBumpSlots, buildShapeTerms, headingOf, type ShapeTermsInput } from './shape-terms';

const TEST_SEED = 42;

function input(overrides: Partial<ShapeTermsInput> = {}): ShapeTermsInput {
  const view = createTestCellView({ radius: 40, stage: CELL_STAGE.prokaryote, traits: [] });
  return {
    view,
    traits: summariseCellTraits(view),
    timeSeconds: 0,
    speedRatio: 0,
    heading: 0,
    phase: 0,
    stripRow: 0,
    strip: null,
    deformation: REST_DEFORMATION,
    ...overrides,
  };
}

const activeSlots = (bumps: readonly { amplitude: number }[]) => bumps.filter((slot) => slot.amplitude !== 0).length;

const withTraits = (traits: { traitId: TraitId; tier: 1 | 2 | 3 }[], stage: CellStage = CELL_STAGE.eukaryote) => {
  const view = createTestCellView({ radius: 40, stage, traits });
  return input({ view, traits: summariseCellTraits(view), strip: buildNoiseStrip(createSeededRandom(TEST_SEED)) });
};

describe('rest scales per trait and form', () => {
  it('halves breathing and lobes with cytoskeleton and keeps the jitter', () => {
    const plain = buildShapeTerms({ ...withTraits([]), timeSeconds: 0.5 });
    const taut = buildShapeTerms({ ...withTraits([{ traitId: 'cytoskeleton', tier: 1 }]), timeSeconds: 0.5 });
    expect(taut.breathing).toBeCloseTo(plain.breathing * WOBBLE_TAUT_SCALE, 12);
    expect(taut.strip?.lobesScale).toBe(WOBBLE_TAUT_SCALE);
    expect(taut.strip?.jitterAmplitude).toBe(JITTER_AMPLITUDE);
  });

  it('stills a rigid diatom valve entirely and gives a slipper the mode-3 wobble', () => {
    const diatom = buildShapeTerms({
      ...withTraits([{ traitId: 'diatom_shell', tier: 1 }], CELL_STAGE.specialised),
      timeSeconds: 0.5,
    });
    expect(diatom.breathing).toBe(0);
    expect(diatom.wobble.amplitude).toBe(0);
    expect(diatom.strip).toMatchObject({ lobesScale: 0, jitterAmplitude: 0 });
    const slipper = buildShapeTerms(withTraits([{ traitId: 'paramecium_cilia', tier: 1 }], CELL_STAGE.specialised));
    expect(slipper.wobble.mode).toBe(FORM_WOBBLE_MODE);
    expect(slipper.form).toBeNull();
  });

  it('reaches to the trait halo with a chloroplast or a toxin bladder', () => {
    expect(buildShapeTerms(withTraits([{ traitId: 'chloroplast', tier: 1 }])).haloOuterRadii).toBe(
      TRAIT_HALO_OUTER_RADII,
    );
    expect(buildShapeTerms(withTraits([{ traitId: 'toxin_vacuole', tier: 1 }])).haloOuterRadii).toBe(
      TRAIT_HALO_OUTER_RADII,
    );
  });
});

describe('assignBumpSlots', () => {
  it('always fills exactly MAX_SHAPE_BUMPS slots, zero where unused', () => {
    const slots = assignBumpSlots([]);
    expect(slots).toHaveLength(MAX_SHAPE_BUMPS);
    expect(slots.every((slot) => slot === ZERO_BUMP)).toBe(true);
  });

  it('keeps the bumps it is handed in order and cuts past the eighth', () => {
    const bumps = Array.from({ length: MAX_SHAPE_BUMPS + 2 }, (_unused, index) => ({
      amplitude: 0.1 * (index + 1),
      centre: index,
      sigma: 0.3,
    }));
    const slots = assignBumpSlots(bumps);
    expect(slots).toHaveLength(MAX_SHAPE_BUMPS);
    expect(activeSlots(slots)).toBe(MAX_SHAPE_BUMPS);
    expect(slots[0]).toBe(bumps[0]);
    expect(slots).not.toContain(bumps[MAX_SHAPE_BUMPS]);
  });
});

describe('buildShapeTerms', () => {
  it('stretches along the heading by the speed ratio and the sprint', () => {
    const sprinting = createTestCellView({ radius: 40, sprintRemainingTicks: 5, velocityX: 3, velocityY: 0 });
    const terms = buildShapeTerms(input({ view: sprinting, speedRatio: 1 }));
    expect(terms.stretch.k).toBe(1);
    expect(terms.stretch.along).toBe(STRETCH_ALONG);
    expect(terms.stretch.axialAlong).toBe(SPRINT_STRETCH_SCALE);
    expect(terms.stretch.axialAcross).toBe(1);
    expect(terms.isSprinting).toBe(true);
    expect(terms.pulse).toBe(1);
    expect(buildShapeTerms(input()).stretch.axialAlong).toBe(1);
  });

  it('breathes at BREATH_HZ from the cosmetic phase and wobbles a protocell in mode 2', () => {
    const protocell = createTestCellView({ stage: CELL_STAGE.protocell, traits: [] });
    const terms = buildShapeTerms(input({ view: protocell, traits: summariseCellTraits(protocell), phase: 0.25 }));
    expect(terms.breathing).toBeCloseTo(BREATH_AMPLITUDE, 9);
    expect(terms.wobble.mode).toBe(PROTOCELL_WOBBLE_MODE);
    expect(terms.wobble.phase).toBeCloseTo(Math.PI / 2, 9);
    expect(terms.haloOuterRadii).toBe(PROTOCELL_HALO_OUTER_RADII);
    expect(buildShapeTerms(input()).wobble.amplitude).toBe(0);
    expect(buildShapeTerms(input()).haloOuterRadii).toBe(HALO_OUTER_RADII);
  });

  it('reads the strip row and phase into the strip term at full lobes', () => {
    const strip = buildNoiseStrip(createSeededRandom(TEST_SEED));
    const terms = buildShapeTerms(input({ strip, stripRow: 3, phase: 0.4 }));
    expect(terms.strip).toMatchObject({ row: 3, phase: 0.4, jitterAmplitude: JITTER_AMPLITUDE, lobesScale: 1 });
    expect(buildShapeTerms(input()).strip).toBeNull();
  });

  it('reports a reach that covers the halo, the stretch and the bumps, under the 3.0 quad floor at rest', () => {
    const rest = buildShapeTerms(input());
    expect(rest.maxRadii).toBeCloseTo(HALO_OUTER_RADII * (1 + BREATH_AMPLITUDE * 0), 6);
    const wrap = buildShapeTerms(
      input({
        speedRatio: 1,
        deformation: {
          ...REST_DEFORMATION,
          bumps: [
            { amplitude: 0.62, centre: degreesToRadians(30), sigma: degreesToRadians(16) },
            { amplitude: 0.62, centre: degreesToRadians(-30), sigma: degreesToRadians(16) },
          ],
        },
      }),
    );
    expect(wrap.maxRadii).toBeGreaterThan(rest.maxRadii);
    expect(wrap.maxRadii).toBeLessThan(CELL_QUAD_EXTENT_RADII);
  });

  it('reads the heading from the velocity while moving and holds it at rest, and carries the resolved one', () => {
    expect(headingOf({ velocityX: 0, velocityY: 1 }, 0.5, 0)).toBeCloseTo(Math.PI / 2, 9);
    expect(headingOf({ velocityX: 0, velocityY: 1 }, 0, 0.7)).toBe(0.7);
    expect(buildShapeTerms(input({ heading: 1 })).heading).toBe(1);
  });

  it('scales the body by the deformation’s pulse', () => {
    const terms = buildShapeTerms(input({ deformation: { ...REST_DEFORMATION, pulse: 1.09 } }));
    expect(terms.pulse).toBe(1.09);
    expect(terms.maxRadii).toBeCloseTo(1.09 * buildShapeTerms(input()).maxRadii, 9);
  });
});

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
  it('reaches the lobes for the engulfed prey and otherwise along the heading', () => {
    const count = 4;
    const lobesOf = (terms: { bumps: readonly { centre: number }[] }) => terms.bumps.slice(0, count);
    const heading = buildShapeTerms({ ...amoeba(3), heading: 1, speedRatio: 1 });
    const engulfing = buildShapeTerms({
      ...amoeba(3),
      heading: 1,
      speedRatio: 1,
      deformation: { ...REST_DEFORMATION, preyAngle: -2 },
    });
    const meanCentre = (lobes: readonly { centre: number }[]) =>
      Math.atan2(
        lobes.reduce((sum, lobe) => sum + Math.sin(lobe.centre), 0),
        lobes.reduce((sum, lobe) => sum + Math.cos(lobe.centre), 0),
      );
    expect(meanCentre(lobesOf(heading))).toBeCloseTo(1, 6);
    expect(meanCentre(lobesOf(engulfing))).toBeCloseTo(-2, 6);
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
