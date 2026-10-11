// docs/ecology/giants.md §3.5.14 and acceptance G14: the giants' builds, born ranges and speed multipliers hold the rules
// `giantBalanceProblems` checks (the same checks `debug_set_balance` refuses a patch on), each rule goes red on a balance
// that breaks it, and two bounds hold on the defaults alone: no giant outweighs what a cell can reach, and a cell entering
// the dish is never inside the hunter's window.

import { describe, expect, it } from 'vitest';
import { GIANT_ROLE, GIANT_SPECIES, type GiantSpecies, type TraitId } from '../types/game.js';
import { foldModifiers } from '../simulation/cell-modifiers.js';
import { giantBalanceProblems } from '../simulation/giant-balance.js';
import { DEFAULT_BALANCE, type BalanceConfig } from './balance.js';
import {
  GIANT_BORN_MASS_MIN_BY_SPECIES,
  GIANT_BUILDS_BY_SPECIES,
  GIANT_HUNT_MIN_PREY_MASS_FRACTION,
  GIANT_MASS_CEILING,
  GIANT_ROLE_BY_SPECIES,
} from './giants.js';

const EVERY_SPECIES: readonly GiantSpecies[] = Object.values(GIANT_SPECIES);
/** The form each species is named after (giants.md §3.5.4). */
const FORM_BY_SPECIES: Readonly<Record<GiantSpecies, TraitId>> = {
  [GIANT_SPECIES.amoeba]: 'amoeba_pseudopods',
  [GIANT_SPECIES.paramecium]: 'paramecium_cilia',
  [GIANT_SPECIES.diatom]: 'diatom_shell',
};

const NUCLEOID: TraitId = 'nucleoid';
const CYTOSKELETON: TraitId = 'cytoskeleton';

/** A writable copy of the defaults for one broken rule. */
function patchedBalance(patch: (balance: BalanceConfig) => void): BalanceConfig {
  const balance = structuredClone(DEFAULT_BALANCE);
  patch(balance);
  return balance;
}

describe('the default giants (G14)', () => {
  it('break no rule: every build a valid ladder ending in a form, every born range in bounds, no multiplier above 1', () => {
    expect(giantBalanceProblems(DEFAULT_BALANCE)).toEqual([]);
  });

  it.each(EVERY_SPECIES)('%s ends its build in its own form', (species) => {
    expect(GIANT_BUILDS_BY_SPECIES[species].at(-1)?.traitId).toBe(FORM_BY_SPECIES[species]);
  });

  it.each(EVERY_SPECIES)(
    '%s at the ceiling stays swallowable under CELL_MAX_MASS (1875, 1875, 2100 < 5000)',
    (species) => {
      const { membraneRatioBonus } = foldModifiers(
        GIANT_BUILDS_BY_SPECIES[species],
        DEFAULT_BALANCE.traits.TRAIT_TIERS,
      );
      const ratio = DEFAULT_BALANCE.absorption.ENGULF_MASS_RATIO + membraneRatioBonus;
      expect(GIANT_MASS_CEILING * ratio).toBeLessThan(DEFAULT_BALANCE.growth.CELL_MAX_MASS);
    },
  );

  it('opens the hunt window above ENTRY_MAX_MASS, so a cell entering the dish is never giant prey (225 > 200)', () => {
    const hunters = Object.values(GIANT_SPECIES).filter(
      (species) => GIANT_ROLE_BY_SPECIES[species] === GIANT_ROLE.hunter,
    );
    const lightestHunter = Math.min(...hunters.map((species) => GIANT_BORN_MASS_MIN_BY_SPECIES[species]));
    expect(lightestHunter * GIANT_HUNT_MIN_PREY_MASS_FRACTION).toBeGreaterThan(
      DEFAULT_BALANCE.progression.ENTRY_MAX_MASS,
    );
  });

  it('casts one hunter, one grazer and one drifter', () => {
    expect(Object.values(GIANT_ROLE_BY_SPECIES).sort()).toEqual(Object.values(GIANT_ROLE).sort());
    expect(GIANT_ROLE_BY_SPECIES[GIANT_SPECIES.amoeba]).toBe(GIANT_ROLE.hunter);
  });
});

describe('giantBalanceProblems: each rule goes red on a balance that breaks it', () => {
  const amoeba = GIANT_SPECIES.amoeba;
  type AmoebaBuild = BalanceConfig['giants']['GIANT_BUILDS_BY_SPECIES'][typeof amoeba];
  /** Replaces the amoeba's build with `rebuild` of it. */
  const rebuildAmoeba = (rebuild: (build: AmoebaBuild) => AmoebaBuild) => (balance: BalanceConfig) => {
    balance.giants.GIANT_BUILDS_BY_SPECIES[amoeba] = rebuild(balance.giants.GIANT_BUILDS_BY_SPECIES[amoeba]);
  };

  it.each([
    ['a trait before the stage it needs', rebuildAmoeba((build) => [...build].reverse()), /needs stage/],
    [
      'a missing requirement',
      rebuildAmoeba((build) => build.filter(({ traitId }) => traitId !== CYTOSKELETON)),
      /requires cytoskeleton/,
    ],
    [
      'a repeated trait',
      rebuildAmoeba((build) => build.map((entry, index) => (index === 1 ? { ...entry, traitId: NUCLEOID } : entry))),
      /listed twice/,
    ],
    [
      'a trait not in the catalog',
      rebuildAmoeba((build) =>
        build.map((entry, index) => (index === 0 ? { ...entry, traitId: 'no_such_trait' as TraitId } : entry)),
      ),
      /no_such_trait is not in the trait catalog/,
    ],
    [
      'a tier below the first',
      rebuildAmoeba((build) => build.map((entry, index) => (index === 0 ? { ...entry, tier: 0 } : entry))),
      /tier 0 is outside 1\.\./,
    ],
    ['a tier past the top', (balance: BalanceConfig) => (balance.traits.TRAIT_TIER_COUNT = 1), /tier 2 is outside/],
    ['no form at the end', rebuildAmoeba((build) => build.slice(0, -1)), /does not end in a form/],
    [
      'a born minimum above its maximum',
      (balance: BalanceConfig) => (balance.giants.GIANT_BORN_MASS_MIN_BY_SPECIES[amoeba] = 1600),
      /minimum 1600 is above its maximum 1500/,
    ],
    [
      'a born maximum past the ceiling',
      (balance: BalanceConfig) => (balance.giants.GIANT_MASS_CEILING = 1400),
      /\[900, 1500\] is outside .*GIANT_MASS_CEILING 1400/,
    ],
    [
      'a born minimum under the starting mass',
      (balance: BalanceConfig) => (balance.growth.CELL_STARTING_MASS = 901),
      /\[900, 1500\] is outside \[CELL_STARTING_MASS 901/,
    ],
    [
      'a speed multiplier above 1',
      (balance: BalanceConfig) => (balance.giants.GIANT_SPEED_MULTIPLIER_BY_SPECIES[amoeba] = 1.5),
      /speed multiplier 1.5 is above 1/,
    ],
  ])('%s', (_rule, breakRule, message) => {
    const amoebaProblems = giantBalanceProblems(patchedBalance(breakRule)).filter((problem) =>
      problem.startsWith(`${amoeba} `),
    );
    expect(amoebaProblems).toHaveLength(1);
    expect(amoebaProblems[0]).toMatch(message);
  });

  it('accepts a born range exactly on its bounds and a multiplier of exactly 1', () => {
    const balance = patchedBalance((patched) => {
      patched.giants.GIANT_BORN_MASS_MIN_BY_SPECIES[amoeba] = patched.growth.CELL_STARTING_MASS;
      patched.giants.GIANT_BORN_MASS_MAX_BY_SPECIES[amoeba] = patched.giants.GIANT_MASS_CEILING;
      patched.giants.GIANT_SPEED_MULTIPLIER_BY_SPECIES[amoeba] = 1;
    });
    expect(giantBalanceProblems(balance)).toEqual([]);
  });
});
