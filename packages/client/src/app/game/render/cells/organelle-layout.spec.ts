// docs/RENDERING.md §9: slot centres inside 0.92 and outside the keep-out, outside the nucleus
// disc, gap held, append-only across tiers, seeded.
import { describe, expect, it } from 'vitest';
import { CELL_STAGE, createSeededRandom } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import {
  DNA_RING_KEEP_OUT_FRACTION,
  NUCLEUS_OFFSET_TOWARD_LIGHT,
  NUCLEUS_RADIUS,
  ORGANELLE_KIND,
  ORGANELLE_MEMBRANE_MARGIN,
  ORGANELLE_MIN_GAP,
  PROTOCELL_GRANULE_COUNT,
} from '../constants';
import { summariseCellTraits } from './cell-traits';
import { NUCLEUS_KINDS } from './organelle-kinds';
import { layoutOrganelles, type OrganelleSlot } from './organelle-layout';

const TEST_SEED = 42;
const TOLERANCE = 1e-9;

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
      expect(distanceOf(slot)).toBeGreaterThan(NUCLEUS_RADIUS);
    }
  });

  it('holds the gap between organelle sprites', () => {
    const slots = layoutOrganelles(eukaryote(3), createSeededRandom(TEST_SEED)).filter((slot) => !isNucleus(slot));
    for (const first of slots) {
      for (const second of slots) {
        if (first === second) continue;
        const gap = Math.hypot(first.x - second.x, first.y - second.y) - first.size / 2 - second.size / 2;
        expect(gap).toBeGreaterThanOrEqual(ORGANELLE_MIN_GAP - TOLERANCE);
      }
    }
  });

  it('appends a bean on a tier-up without moving the existing slots', () => {
    const random = createSeededRandom(TEST_SEED);
    const before = layoutOrganelles(eukaryote(1), random);
    const after = layoutOrganelles(eukaryote(2), random, before);
    expect(after.filter((slot) => slot.kind === ORGANELLE_KIND.mitochondrion)).toHaveLength(2);
    for (const slot of before) expect(after).toContain(slot);
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
