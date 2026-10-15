// docs/game-design/early-life.md §15.5.1: the swallow switch's two checks, each on an empty and a non-empty list, a cell
// owning a listed trait (at any tier) and one owning none.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { withEveryCellSwallowing, withSwallowGateTraits } from '../testing/swallow-balance.js';
import type { OwnedTrait, TraitTier } from '../types/game.js';
import { canSwallowByTraits, ownsSwallowGateTrait } from './swallow-gate.js';

/** The flip's switch (early-life.md §15.10). */
const switchOn = withSwallowGateTraits(['cytoskeleton']).absorption;
/** A gate of two traits: owning either opens it. */
const twoTraitGate = withSwallowGateTraits(['cytoskeleton', 'food_vacuole']).absorption;
const switchOff = withEveryCellSwallowing().absorption;
const TIERS: readonly TraitTier[] = [1, 2, 3];

/** An archaeon (`nucleoid` I), with the Lattice at `latticeTier` when one is given. */
const archaeon = (latticeTier?: TraitTier): OwnedTrait[] => [
  { traitId: 'nucleoid', tier: 1 },
  ...(latticeTier === undefined ? [] : [{ traitId: 'cytoskeleton' as const, tier: latticeTier }]),
];
const NO_TRAITS: OwnedTrait[] = [];

describe('canSwallowByTraits', () => {
  it('lets every cell swallow with the list empty, the shipping switch included: no gate', () => {
    expect(DEFAULT_BALANCE.absorption.SWALLOW_GATE_TRAITS).toEqual([]);
    for (const absorption of [switchOff, DEFAULT_BALANCE.absorption]) {
      expect(canSwallowByTraits(NO_TRAITS, absorption)).toBe(true);
      expect(canSwallowByTraits(archaeon(), absorption)).toBe(true);
      expect(canSwallowByTraits(archaeon(1), absorption)).toBe(true);
    }
  });

  it.each(TIERS)('lets a cell owning a listed trait at tier %s swallow with the list set', (tier) => {
    expect(canSwallowByTraits(archaeon(tier), switchOn)).toBe(true);
  });

  it('refuses a cell owning no listed trait with the list set, and one with no traits at all', () => {
    expect(canSwallowByTraits(archaeon(), switchOn)).toBe(false);
    expect(canSwallowByTraits(NO_TRAITS, switchOn)).toBe(false);
  });

  it('opens on any listed trait: either of two', () => {
    expect(canSwallowByTraits(archaeon(1), twoTraitGate)).toBe(true);
    expect(canSwallowByTraits([{ traitId: 'food_vacuole', tier: 1 }], twoTraitGate)).toBe(true);
    expect(canSwallowByTraits(archaeon(), twoTraitGate)).toBe(false);
  });
});

describe('ownsSwallowGateTrait', () => {
  it('is false for every cell with the list empty, the owner of the Lattice included: no unlock, no popup, no card', () => {
    for (const absorption of [switchOff, DEFAULT_BALANCE.absorption]) {
      expect(ownsSwallowGateTrait(NO_TRAITS, absorption)).toBe(false);
      expect(ownsSwallowGateTrait(archaeon(), absorption)).toBe(false);
      expect(ownsSwallowGateTrait(archaeon(1), absorption)).toBe(false);
    }
  });

  it.each(TIERS)('is true for a cell owning a listed trait at tier %s with the list set', (tier) => {
    expect(ownsSwallowGateTrait(archaeon(tier), switchOn)).toBe(true);
  });

  it('is false for a cell owning no listed trait with the list set', () => {
    expect(ownsSwallowGateTrait(archaeon(), switchOn)).toBe(false);
    expect(ownsSwallowGateTrait(NO_TRAITS, switchOn)).toBe(false);
  });

  it('opens on any listed trait: either of two', () => {
    expect(ownsSwallowGateTrait([{ traitId: 'food_vacuole', tier: 2 }], twoTraitGate)).toBe(true);
    expect(ownsSwallowGateTrait(archaeon(), twoTraitGate)).toBe(false);
  });
});
