// docs/RENDERING.md §9: slot centres inside 0.92 and outside the keep-out, the sprite body inside
// the membrane (#243), outside the nucleus disc, gap held, append-only across tiers, seeded.
import { describe, expect, it } from 'vitest';
import { CELL_STAGE, createSeededRandom } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import {
  DNA_RING_KEEP_OUT_FRACTION,
  NUCLEOID_RADIUS,
  NUCLEUS_OFFSET_TOWARD_LIGHT,
  NUCLEUS_RADIUS,
  ORGANELLE_KIND,
  ORGANELLE_MEMBRANE_MARGIN,
  ORGANELLE_MIN_GAP,
  PROTOCELL_GRANULE_COUNT,
  TOXIN_VACUOLE,
} from '../constants';
import { DIAMETER_PER_RADIUS, HALF } from '../geometry';
import { summariseCellTraits } from './cell-traits';
import { NUCLEUS_KINDS } from './organelle-kinds';
import { layoutOrganelles, membraneKeepOutRadius, type OrganelleSlot } from './organelle-layout';

const TEST_SEED = 42;
const TOLERANCE = 1e-9;
/** The toxin bladder's sprite body diameter in `r`: the widest sprite, and the one that sets the clamp. */
const TOXIN_BLADDER_SIZE = TOXIN_VACUOLE.radius * DIAMETER_PER_RADIUS;

const eukaryote = (mitochondrionTier: 1 | 2 | 3) =>
  summariseCellTraits(
    createTestCellView({
      stage: CELL_STAGE.eukaryote,
      traits: [
        { traitId: 'nuclear_envelope', tier: 1 },
        { traitId: 'mitochondrion', tier: mitochondrionTier },
        { traitId: 'chloroplast', tier: 2 },
        { traitId: 'food_vacuole', tier: 2 },
        { traitId: 'toxin_vacuole', tier: 1 },
      ],
    }),
  );

const distanceOf = (slot: OrganelleSlot) => Math.hypot(slot.x, slot.y);
const isNucleus = (slot: OrganelleSlot) => NUCLEUS_KINDS.has(slot.kind);

/** The smallest edge-to-edge gap between any two organelle sprites (the nucleus excluded). */
function smallestSpriteGap(slots: readonly OrganelleSlot[]): number {
  const sprites = slots.filter((slot) => !isNucleus(slot));
  let smallest = Number.POSITIVE_INFINITY;
  for (const first of sprites) {
    for (const second of sprites) {
      if (first === second) continue;
      smallest = Math.min(
        smallest,
        Math.hypot(first.x - second.x, first.y - second.y) - first.size / 2 - second.size / 2,
      );
    }
  }
  return smallest;
}

describe('layoutOrganelles', () => {
  it('places the nucleus 0.12 r toward the light and every organelle in the annulus, clear of the disc', () => {
    const slots = layoutOrganelles(eukaryote(3), createSeededRandom(TEST_SEED));
    const nucleus = slots.find((slot) => slot.kind === ORGANELLE_KIND.nucleus)!;
    expect(distanceOf(nucleus)).toBeCloseTo(NUCLEUS_OFFSET_TOWARD_LIGHT, 9);
    expect(nucleus.x).toBeLessThan(0);
    expect(nucleus.y).toBeLessThan(0);
    for (const slot of slots.filter((candidate) => !isNucleus(candidate))) {
      expect(distanceOf(slot)).toBeGreaterThanOrEqual(DNA_RING_KEEP_OUT_FRACTION - TOLERANCE);
      expect(distanceOf(slot)).toBeLessThanOrEqual(1 - ORGANELLE_MEMBRANE_MARGIN + TOLERANCE);
      expect(Math.hypot(slot.x - nucleus.x, slot.y - nucleus.y)).toBeGreaterThan(
        Math.max(NUCLEUS_RADIUS, NUCLEOID_RADIUS),
      );
    }
  });

  it('keeps every sprite body inside the membrane: centre + own radius ≤ 1 r, for every seed (#243)', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const slots = layoutOrganelles(eukaryote(3), createSeededRandom(seed));
      for (const slot of slots.filter((candidate) => !isNucleus(candidate))) {
        expect(distanceOf(slot) + slot.size / 2).toBeLessThanOrEqual(1 + TOLERANCE);
        expect(distanceOf(slot)).toBeLessThanOrEqual(membraneKeepOutRadius(slot.size) + TOLERANCE);
      }
      const bladder = slots.find((slot) => slot.kind === ORGANELLE_KIND.toxinVacuole)!;
      expect(bladder.size).toBeCloseTo(TOXIN_BLADDER_SIZE, 12);
      expect(distanceOf(bladder)).toBeCloseTo(membraneKeepOutRadius(TOXIN_BLADDER_SIZE), 9);
    }
  });

  it('keeps out by the margin for a small sprite and by the sprite radius for a large one, never inside the DNA ring', () => {
    // The three regimes by the sprite's own radius against the margin and the DNA ring, all derived
    // from the constants: below the margin, between it and the ring, and clamped at the ring (#243).
    const marginBoundarySize = ORGANELLE_MEMBRANE_MARGIN * DIAMETER_PER_RADIUS;
    const ringBoundarySize = (1 - DNA_RING_KEEP_OUT_FRACTION) * DIAMETER_PER_RADIUS;
    const spriteRadiusRegimeSize = (marginBoundarySize + ringBoundarySize) * HALF;
    expect(membraneKeepOutRadius(marginBoundarySize * HALF)).toBeCloseTo(1 - ORGANELLE_MEMBRANE_MARGIN, 12);
    expect(membraneKeepOutRadius(marginBoundarySize)).toBeCloseTo(1 - ORGANELLE_MEMBRANE_MARGIN, 12);
    expect(membraneKeepOutRadius(spriteRadiusRegimeSize)).toBeCloseTo(1 - spriteRadiusRegimeSize * HALF, 12);
    expect(membraneKeepOutRadius(ringBoundarySize)).toBeCloseTo(DNA_RING_KEEP_OUT_FRACTION, 12);
    expect(membraneKeepOutRadius(ringBoundarySize + marginBoundarySize)).toBe(DNA_RING_KEEP_OUT_FRACTION);
    // Today's toxin bladder is exactly the ring-boundary sprite, which is why it sits on the ring.
    expect(TOXIN_BLADDER_SIZE).toBeCloseTo(ringBoundarySize, 12);
  });

  it('measures the nucleus disc from the off-centre nucleus, for every seed', () => {
    const reach = Math.max(NUCLEUS_RADIUS, NUCLEOID_RADIUS);
    for (let seed = 0; seed < 50; seed += 1) {
      const slots = layoutOrganelles(eukaryote(3), createSeededRandom(seed));
      const nucleus = slots.find(isNucleus)!;
      for (const slot of slots.filter((candidate) => !isNucleus(candidate))) {
        expect(Math.hypot(slot.x - nucleus.x, slot.y - nucleus.y)).toBeGreaterThan(reach);
      }
    }
  });

  it('holds the gap between organelle sprites', () => {
    const slots = layoutOrganelles(eukaryote(3), createSeededRandom(TEST_SEED));
    expect(smallestSpriteGap(slots)).toBeGreaterThanOrEqual(ORGANELLE_MIN_GAP - TOLERANCE);
  });

  it('appends a bean on a tier-up without moving the existing slots', () => {
    const random = createSeededRandom(TEST_SEED);
    const before = layoutOrganelles(eukaryote(1), random);
    const after = layoutOrganelles(eukaryote(2), random, before);
    expect(after.filter((slot) => slot.kind === ORGANELLE_KIND.mitochondrion)).toHaveLength(2);
    for (const slot of before) expect(after).toContain(slot);
  });

  it('gap-checks a new earlier-order slot against the kept later-order ones, for every seed', () => {
    const green = summariseCellTraits(
      createTestCellView({ stage: CELL_STAGE.eukaryote, traits: [{ traitId: 'chloroplast', tier: 3 }] }),
    );
    const greenWithBeans = summariseCellTraits(
      createTestCellView({
        stage: CELL_STAGE.eukaryote,
        traits: [
          { traitId: 'chloroplast', tier: 3 },
          { traitId: 'mitochondrion', tier: 3 },
        ],
      }),
    );
    for (let seed = 0; seed < 50; seed += 1) {
      const random = createSeededRandom(seed);
      const before = layoutOrganelles(green, random);
      const after = layoutOrganelles(greenWithBeans, random, before);
      expect(smallestSpriteGap(after)).toBeGreaterThanOrEqual(ORGANELLE_MIN_GAP - TOLERANCE);
    }
  });

  it('drops a slot whose kind is no longer wanted and keeps the rest', () => {
    const random = createSeededRandom(TEST_SEED);
    const before = layoutOrganelles(eukaryote(3), random);
    const after = layoutOrganelles(eukaryote(1), random, before);
    expect(after.filter((slot) => slot.kind === ORGANELLE_KIND.mitochondrion)).toHaveLength(1);
    for (const slot of after) expect(before).toContain(slot);
  });

  it('is seeded: same seed same slots, another seed other slots', () => {
    const first = layoutOrganelles(eukaryote(3), createSeededRandom(TEST_SEED));
    expect(layoutOrganelles(eukaryote(3), createSeededRandom(TEST_SEED))).toEqual(first);
    expect(layoutOrganelles(eukaryote(3), createSeededRandom(TEST_SEED + 1))).not.toEqual(first);
  });

  it('gives a protocell granules and no nucleus, and a prokaryote a nucleoid and lipids', () => {
    const protocell = summariseCellTraits(createTestCellView({ stage: CELL_STAGE.protocell }));
    const kinds = layoutOrganelles(protocell, createSeededRandom(TEST_SEED)).map((slot) => slot.kind);
    expect(kinds).toEqual(Array.from({ length: PROTOCELL_GRANULE_COUNT }, () => ORGANELLE_KIND.protocellGranule));
    const prokaryote = summariseCellTraits(createTestCellView({ stage: CELL_STAGE.prokaryote, traits: [] }));
    const prokaryoteKinds = layoutOrganelles(prokaryote, createSeededRandom(TEST_SEED)).map((slot) => slot.kind);
    expect(prokaryoteKinds).toEqual([ORGANELLE_KIND.nucleoid, ORGANELLE_KIND.lipid, ORGANELLE_KIND.lipid]);
  });
});
