// docs/TRAITS.md §2 and §6 T1: the fold over owned traits.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { DEFAULT_CELL_MODIFIERS } from '../constants/trait-modifiers.js';
import type { CellModifiers } from '../types/traits.js';
import { MODIFIER_FOLD_RULES, MODIFIER_NAMES, foldModifiers } from './cell-modifiers.js';

const tierTables = DEFAULT_BALANCE.traits.TRAIT_TIERS;

describe('foldModifiers', () => {
  it('T1: Cilia Fringe I + Cell Wall I + Cytoskeleton Lattice I', () => {
    const folded = foldModifiers(
      [
        { traitId: 'cilia', tier: 1 },
        { traitId: 'cell_wall', tier: 1 },
        { traitId: 'cytoskeleton', tier: 1 },
      ],
      tierTables,
    );
    expect(folded.speedMultiplier).toBeCloseTo(1.045, 12);
    expect(folded.accelerationSecondsMultiplier).toBe(0.85);
    expect(folded.membraneRatioBonus).toBe(0.15);
    const changed: (keyof CellModifiers)[] = ['speedMultiplier', 'accelerationSecondsMultiplier', 'membraneRatioBonus'];
    for (const name of MODIFIER_NAMES) {
      if (!changed.includes(name)) expect(folded[name], name).toBe(DEFAULT_CELL_MODIFIERS[name]);
    }
  });

  it('is the identity for no traits and never returns the shared default record', () => {
    const folded = foldModifiers([], tierTables);
    expect(folded).toEqual(DEFAULT_CELL_MODIFIERS);
    expect(folded).not.toBe(DEFAULT_CELL_MODIFIERS);
  });

  it('reads the tier the trait is owned at', () => {
    expect(foldModifiers([{ traitId: 'nucleoid', tier: 3 }], tierTables).dnaGainMultiplier).toBe(1.15);
  });

  it('adds bonuses, multiplies multipliers and takes the max of floors', () => {
    const folded = foldModifiers(
      [
        { traitId: 'simple_flagellum', tier: 2 },
        { traitId: 'mitochondrion', tier: 1 },
        { traitId: 'cell_wall', tier: 1 },
        { traitId: 'amoeba_pseudopods', tier: 2 },
      ],
      tierTables,
    );
    expect(folded.sprintSpeedMultiplierBonus).toBeCloseTo(0.7, 12);
    expect(folded.speedMultiplier).toBeCloseTo(1.05 * 0.95, 12);
    expect(folded.gelSpeedFactorFloor).toBe(0.8);
  });

  it('caps the kept-on-death share at one', () => {
    expect(MODIFIER_FOLD_RULES.dnaKeptOnDeathFraction.cap).toBe(1);
    const folded = foldModifiers(
      [
        { traitId: 'nuclear_envelope', tier: 3 },
        { traitId: 'nuclear_envelope', tier: 3 },
      ],
      tierTables,
    );
    expect(folded.dnaKeptOnDeathFraction).toBe(1);
  });

  it('declares a fold rule for every modifier of the identity record', () => {
    expect([...MODIFIER_NAMES].sort()).toEqual(Object.keys(DEFAULT_CELL_MODIFIERS).sort());
  });
});
