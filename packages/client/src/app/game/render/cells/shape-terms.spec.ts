// docs/RENDERING.md §9: view → terms, the eight bump slots (amoeba III mid-engulf), contact and eat
// dropped while engulfing, sprint scaling and the moving-wrap extent under CELL_QUAD_EXTENT_RADII.

import { describe, expect, it } from 'vitest';
import { CELL_STAGE } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { CELL_QUAD_EXTENT_RADII, HALO_KIND, MAX_SHAPE_BUMPS, TRAIT_HALO_OUTER_RADII } from '../constants';
import { degreesToRadians } from '../geometry';
import { summariseCellTraits } from './cell-traits';
import {
  ZERO_BUMP,
  assignBumpSlots,
  buildShapeTerms,
  headingOf,
  type ShapeClipValues,
  type ShapeTermsInput,
} from './shape-terms';

const IDLE_CLIPS: ShapeClipValues = { eat: null, engulf: null, absorbedSeal: null, pulse: 1, sprintStretch: 1 };
const EAT_WRAP = { dimple: -0.12, wrap: 0.14, pulse: 1.09, stretchAlong: 1.07, stretchAcross: 0.95 };
const ENGULF_WRAP = { arm: 0.62, notch: -0.1, seal: 0 };

function input(overrides: Partial<ShapeTermsInput> = {}): ShapeTermsInput {
  const view = createTestCellView({ radius: 40, velocityX: 0, velocityY: 0 });
  return {
    view,
    traits: summariseCellTraits(view),
    timeSeconds: 0,
    speedRatio: 0,
    heldHeading: 0,
    phase: 0,
    stripRow: 0,
    strip: null,
    clips: IDLE_CLIPS,
    preyAngle: null,
    moteAngle: null,
    contactDent: null,
    pseudopods: [],
    form: null,
    ...overrides,
  };
}

const activeSlots = (bumps: readonly { amplitude: number }[]) => bumps.filter((slot) => slot.amplitude !== 0).length;

describe('assignBumpSlots', () => {
  it('always fills exactly MAX_SHAPE_BUMPS slots, zero where unused', () => {
    const slots = assignBumpSlots(input(), false);
    expect(slots).toHaveLength(MAX_SHAPE_BUMPS);
    expect(slots.every((slot) => slot === ZERO_BUMP)).toBe(true);
  });

  it('fills all eight for an amoeba III mid-engulf: two arms, notch, seal and four pseudopods', () => {
    const pseudopods = [0, 1, 2, 3].map((index) => ({ amplitude: 0.3, centre: index, sigma: 0.3 }));
    const slots = assignBumpSlots(
      input({ clips: { ...IDLE_CLIPS, engulf: { ...ENGULF_WRAP, seal: 0.2 } }, preyAngle: 0, pseudopods }),
      true,
    );
    expect(activeSlots(slots)).toBe(MAX_SHAPE_BUMPS);
  });

  it('drops the contact dent and the eat bumps while engulfing', () => {
    const dent = { amplitude: -0.12, centre: 1, sigma: 1 };
    const engulfing = input({
      clips: { ...IDLE_CLIPS, eat: EAT_WRAP, engulf: ENGULF_WRAP },
      contactDent: dent,
      moteAngle: 1,
    });
    const slots = assignBumpSlots(engulfing, true);
    expect(activeSlots(slots)).toBe(3);
    expect(slots.some((slot) => slot.amplitude === -0.12)).toBe(false);
    const resting = assignBumpSlots(
      input({ clips: { ...IDLE_CLIPS, eat: EAT_WRAP }, contactDent: dent, moteAngle: 1 }),
      false,
    );
    expect(activeSlots(resting)).toBe(3);
  });

  it('places the arms at the prey angle ± 30° and sharpens the dent with cytoskeleton', () => {
    const slots = assignBumpSlots(
      input({ clips: { ...IDLE_CLIPS, engulf: ENGULF_WRAP }, preyAngle: degreesToRadians(90) }),
      true,
    );
    expect(slots[0]!.centre).toBeCloseTo(degreesToRadians(120), 9);
    expect(slots[1]!.centre).toBeCloseTo(degreesToRadians(60), 9);
    const taut = createTestCellView({ traits: [{ traitId: 'cytoskeleton', tier: 1 }] });
    const dent = { amplitude: -0.12, centre: 0, sigma: 1 };
    const tautSlots = assignBumpSlots(
      input({ view: taut, traits: summariseCellTraits(taut), contactDent: dent }),
      false,
    );
    expect(tautSlots[2]!.sigma).toBeCloseTo(degreesToRadians(14), 9);
  });
});

describe('buildShapeTerms', () => {
  it('scales the sprint stretch and the eat pulse into the profile terms', () => {
    const terms = buildShapeTerms(
      input({ clips: { ...IDLE_CLIPS, eat: EAT_WRAP, sprintStretch: 1.06 }, speedRatio: 1 }),
    );
    expect(terms.stretch.axialAlong).toBeCloseTo(1.07 * 1.06, 9);
    expect(terms.stretch.axialAcross).toBe(0.95);
    expect(terms.pulse).toBeCloseTo(1.09, 9);
    expect(terms.stretch.k).toBe(1);
  });

  it('reports a 2.99 r maximum for the moving wrap with a trait halo, under the 3.0 quad floor', () => {
    const view = createTestCellView({
      radius: 40,
      stage: CELL_STAGE.endosymbiosis,
      traits: [{ traitId: 'chloroplast', tier: 1 }],
    });
    const traits = summariseCellTraits(view);
    expect(traits.haloKind).toBe(HALO_KIND.chloroplast);
    const terms = buildShapeTerms(
      input({
        view,
        traits,
        speedRatio: 1,
        clips: { ...IDLE_CLIPS, engulf: ENGULF_WRAP, eat: { ...EAT_WRAP, stretchAlong: 1, stretchAcross: 1 } },
        preyAngle: 0,
      }),
    );
    expect(terms.haloOuterRadii).toBe(TRAIT_HALO_OUTER_RADII);
    expect(terms.maxRadii).toBeCloseTo(2.99, 1);
    expect(terms.maxRadii).toBeLessThan(CELL_QUAD_EXTENT_RADII);
  });

  it('halves breathing and lobes with cytoskeleton and keeps the protocell wobble', () => {
    const protocell = createTestCellView({ stage: CELL_STAGE.protocell, traits: [] });
    const terms = buildShapeTerms(input({ view: protocell, traits: summariseCellTraits(protocell), timeSeconds: 0.5 }));
    expect(terms.wobble.amplitude).toBe(0.08);
    expect(terms.wobble.mode).toBe(2);
    const taut = createTestCellView({ traits: [{ traitId: 'cytoskeleton', tier: 2 }] });
    const tautTerms = buildShapeTerms(input({ view: taut, traits: summariseCellTraits(taut), timeSeconds: 0.5 }));
    expect(Math.abs(tautTerms.breathing)).toBeCloseTo(0.01, 9);
    expect(tautTerms.isEngulfing).toBe(false);
  });

  it('reads the heading from the velocity while moving and holds it at rest', () => {
    expect(headingOf({ velocityX: 0, velocityY: 1 }, 0.5, 0)).toBeCloseTo(Math.PI / 2, 9);
    expect(headingOf({ velocityX: 0, velocityY: 1 }, 0, 0.7)).toBe(0.7);
  });
});
