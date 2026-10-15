// docs/ecology/absorption.md §6.1 and the boundary rows of its scenarios: E10 (exact ratio), E16
// (hysteresis) and TRAITS T3 (the Cell Wall bonus), and the swallow switch (docs/game-design/early-life.md §15.5.1,
// EL26). Cell views are reduced to what the predicates read; the numbers are the design's. The ratio cases state their
// switch (every cell swallowing, §15.8.5) so they keep testing the ratio when the shipping switch flips.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { ENGULF_RELEASE_REASON } from '../types/effects.js';
import { GIANT_SPECIES, type GiantSpecies, type OwnedTrait, type TraitId } from '../types/game.js';
import { POOL_CREATURE_SPECIES, type PoolCreatureCellSpecies } from '../types/pool.js';
import { withEveryCellSwallowing, withSwallowGateTraits } from '../testing/swallow-balance.js';
import {
  ENGULF_HOLD,
  canContinueEngulf,
  canEngulf,
  eatsCells,
  engulfStartMass,
  hasSpecies,
  meetsEngulfStartRatio,
  resolveEngulfHold,
  type EngulfPredator,
  type EngulfPrey,
} from './engulf-eligibility.js';
import { ENGULF_PHASE } from './engulf-pace.js';

const balance = withEveryCellSwallowing().absorption;
/** The flip's switch (early-life.md §15.10). */
const switchOn = withSwallowGateTraits(['cytoskeleton']).absorption;
/** Cell Wall I's bonus as the catalog declares it (traits/catalog-organelles.md §3.3), so T3 tracks a retune. */
const CELL_WALL_ONE_BONUS = DEFAULT_BALANCE.traits.TRAIT_TIERS.cell_wall[0].membraneRatioBonus ?? 0;
const PREY_MASS = 20;
const JUST_UNDER = 0.01;
/** The exact bound of T3 for a walled prey: `PREY_MASS × (ratio + Cell Wall I)`, computed as the predicate does. */
const walledBound = (ratio: number): number => PREY_MASS * (ratio + CELL_WALL_ONE_BONUS);

const prey = (mass: number, membraneRatioBonus = 0): EngulfPrey => ({ mass, membraneRatioBonus });
/** Tier I of each listed trait: a build as a predator owns it. */
const ownedAtTierOne = (traitIds: readonly TraitId[]): OwnedTrait[] =>
  traitIds.map((traitId) => ({ traitId, tier: 1 }));
/** A player or plain wild predator owning no trait unless a giant species or its traits are given. */
const predator = (
  mass: number,
  giantSpecies: GiantSpecies | null = null,
  traitIds: readonly TraitId[] = [],
): EngulfPredator => ({ mass, giantSpecies, poolCreature: null, traits: ownedAtTierOne(traitIds) });
/** A pool creature's cell (phases.md §14.6), owning no trait: its species alone decides. */
const creature = (mass: number, species: PoolCreatureCellSpecies): EngulfPredator => ({
  mass,
  giantSpecies: null,
  poolCreature: { species },
  traits: [],
});
/** Far past every ratio bound, so only the swallow switch can refuse. */
const HEAVY_PREDATOR_MASS = 1000;

describe('canEngulf (canStart)', () => {
  it('holds at exactly the required ratio: 25 vs 20 (E10)', () => {
    expect(canEngulf(predator(25), prey(20), balance)).toBe(true);
  });

  it('fails one unit under it: 24 vs 20 (E10)', () => {
    expect(canEngulf(predator(24), prey(20), balance)).toBe(false);
  });

  it('never holds both ways: near-equal cells only push apart', () => {
    expect(canEngulf(predator(21), prey(20), balance)).toBe(false);
    expect(canEngulf(predator(20), prey(21), balance)).toBe(false);
  });

  it('adds the Cell Wall bonus of the prey: the exact (ratio + Cell Wall I) × 20 bound holds, just under fails (T3)', () => {
    const bound = walledBound(balance.ENGULF_MASS_RATIO);
    expect(CELL_WALL_ONE_BONUS).toBeGreaterThan(0);
    expect(canEngulf(predator(bound), prey(PREY_MASS, CELL_WALL_ONE_BONUS), balance)).toBe(true);
    expect(canEngulf(predator(bound - JUST_UNDER), prey(PREY_MASS, CELL_WALL_ONE_BONUS), balance)).toBe(false);
  });

  it("ignores the predator's own membrane bonus", () => {
    expect(canEngulf({ ...predator(25), membraneRatioBonus: 1 } as EngulfPredator, prey(20), balance)).toBe(true);
  });

  it('reads the ratio from the balance it is given, not from a module constant', () => {
    const lenient = structuredClone(balance);
    lenient.ENGULF_MASS_RATIO = 1;
    expect(canEngulf(predator(20), prey(20), lenient)).toBe(true);
  });
});

describe('engulfStartMass', () => {
  it('is the exact bound canEngulf starts at, the Cell Wall bonus included (E10, T3)', () => {
    const plainBound = engulfStartMass(prey(PREY_MASS), balance);
    const walledStart = engulfStartMass(prey(PREY_MASS, CELL_WALL_ONE_BONUS), balance);
    expect(walledStart).toBe(walledBound(balance.ENGULF_MASS_RATIO));
    for (const [bound, preyBonus] of [
      [plainBound, 0],
      [walledStart, CELL_WALL_ONE_BONUS],
    ] as const) {
      expect(canEngulf(predator(bound), prey(PREY_MASS, preyBonus), balance)).toBe(true);
      expect(canEngulf(predator(bound - JUST_UNDER), prey(PREY_MASS, preyBonus), balance)).toBe(false);
    }
  });

  it('reads the ratio from the balance it is given', () => {
    const lenient = structuredClone(balance);
    lenient.ENGULF_MASS_RATIO = 1;
    expect(engulfStartMass(prey(PREY_MASS), lenient)).toBe(PREY_MASS);
  });
});

describe('eatsCells and hasSpecies (early-life.md §15.5.1)', () => {
  it('eats cells as a player or a plain wild cell, as the giant hunter only, and as the Didinium or the rotifer', () => {
    expect(eatsCells(predator(1))).toBe(true);
    expect(eatsCells(predator(1, GIANT_SPECIES.amoeba))).toBe(true);
    expect(eatsCells(predator(1, GIANT_SPECIES.paramecium))).toBe(false);
    expect(eatsCells(predator(1, GIANT_SPECIES.diatom))).toBe(false);
    expect(eatsCells(creature(1, POOL_CREATURE_SPECIES.didinium))).toBe(true);
    expect(eatsCells(creature(1, POOL_CREATURE_SPECIES.rotifer))).toBe(true);
    expect(eatsCells(creature(1, POOL_CREATURE_SPECIES.nematode))).toBe(false);
  });

  it('gives a giant and a pool creature a species, and a player or plain wild cell none', () => {
    expect(hasSpecies(predator(1))).toBe(false);
    for (const species of Object.values(GIANT_SPECIES)) expect(hasSpecies(predator(1, species)), species).toBe(true);
    for (const species of [
      POOL_CREATURE_SPECIES.didinium,
      POOL_CREATURE_SPECIES.rotifer,
      POOL_CREATURE_SPECIES.nematode,
    ])
      expect(hasSpecies(creature(1, species)), species).toBe(true);
  });
});

describe('canEngulf for the giant cells (docs/ecology/giants.md §3.5.6, acceptance G4)', () => {
  it('lets the amoeba swallow a cell under its hunt window: 1000 vs 240 (G4, the window gates the chase only)', () => {
    expect(canEngulf(predator(1000, GIANT_SPECIES.amoeba), prey(240), balance)).toBe(true);
  });

  it('keeps the ratio rule for the amoeba: the exact 1.25 bound holds, just under fails', () => {
    expect(canEngulf(predator(1000, GIANT_SPECIES.amoeba), prey(800), balance)).toBe(true);
    expect(canEngulf(predator(1000 - JUST_UNDER, GIANT_SPECIES.amoeba), prey(800), balance)).toBe(false);
  });

  it.each([GIANT_SPECIES.paramecium, GIANT_SPECIES.diatom])(
    'never lets the %s engulf a cell, however small (G4: 1100 and 1200 vs 200)',
    (species) => {
      expect(canEngulf(predator(1100, species), prey(200), balance)).toBe(false);
      expect(canEngulf(predator(1200, species), prey(200), balance)).toBe(false);
      expect(canEngulf(predator(1200, species), prey(PREY_MASS), balance)).toBe(false);
    },
  );

  it('lets a cell engulf any giant the ratio allows, the grazer and the drifter included (they are prey)', () => {
    for (const species of Object.values(GIANT_SPECIES)) {
      expect(canEngulf(predator(1250), { ...prey(1000), giantSpecies: species } as EngulfPrey, balance)).toBe(true);
    }
  });
});

describe('canEngulf and the swallow switch (docs/game-design/early-life.md §15.5.1, EL26)', () => {
  /** EL26's predators, each at 2 × the prey's mass; the wild builds and the giant's as owned picks. */
  const twiceThePrey = 2 * PREY_MASS;
  const eukaryoteTraits: readonly TraitId[] = ['nucleoid', 'mitochondrion', 'nuclear_envelope'];
  const predators = {
    'a wild cell of build 1 at level 3 (nucleoid, cytoskeleton)': predator(twiceThePrey, null, [
      'nucleoid',
      'cytoskeleton',
    ]),
    'a wild cell of build 0 at level 4 (no Lattice)': predator(twiceThePrey, null, eukaryoteTraits),
    'the giant amoeba (no Lattice in its build)': predator(twiceThePrey, GIANT_SPECIES.amoeba, ['nucleoid']),
    'the giant grazer': predator(twiceThePrey, GIANT_SPECIES.paramecium, ['nucleoid']),
    'the giant drifter': predator(twiceThePrey, GIANT_SPECIES.diatom, ['nucleoid']),
    'a eukaryote player without the Lattice': predator(twiceThePrey, null, eukaryoteTraits),
    'a eukaryote player with the Lattice': predator(twiceThePrey, null, [...eukaryoteTraits, 'cytoskeleton']),
    'the Didinium': creature(twiceThePrey, POOL_CREATURE_SPECIES.didinium),
    'the rotifer': creature(twiceThePrey, POOL_CREATURE_SPECIES.rotifer),
    'the nematode': creature(twiceThePrey, POOL_CREATURE_SPECIES.nematode),
  } as const satisfies Record<string, EngulfPredator>;
  type PredatorName = keyof typeof predators;
  const switchOnAnswers: Record<PredatorName, boolean> = {
    'a wild cell of build 1 at level 3 (nucleoid, cytoskeleton)': true,
    'a wild cell of build 0 at level 4 (no Lattice)': false,
    'the giant amoeba (no Lattice in its build)': true,
    'the giant grazer': false,
    'the giant drifter': false,
    'a eukaryote player without the Lattice': false,
    'a eukaryote player with the Lattice': true,
    'the Didinium': true,
    'the rotifer': true,
    'the nematode': false,
  };
  /** With the switch off every one of them swallows except the species that never eat a cell. */
  const neverEaters: readonly PredatorName[] = ['the giant grazer', 'the giant drifter', 'the nematode'];

  it.each(Object.keys(predators) as PredatorName[])('answers EL26 for %s with the switch on', (name) => {
    expect(canEngulf(predators[name], prey(PREY_MASS), switchOn)).toBe(switchOnAnswers[name]);
  });

  it.each(Object.keys(predators) as PredatorName[])('answers EL26 for %s with the switch off', (name) => {
    expect(canEngulf(predators[name], prey(PREY_MASS), balance)).toBe(!neverEaters.includes(name));
  });

  it("ships empty: a cell owning no trait swallows in the default balance, today's game exactly (§15.10)", () => {
    expect(DEFAULT_BALANCE.absorption.SWALLOW_GATE_TRAITS).toEqual([]);
    expect(canEngulf(predator(HEAVY_PREDATOR_MASS), prey(PREY_MASS), DEFAULT_BALANCE.absorption)).toBe(true);
  });

  it('refuses a player predator without the gate trait with the switch on and lets it swallow with the switch off', () => {
    const traitless = predator(HEAVY_PREDATOR_MASS);
    expect(canEngulf(traitless, prey(PREY_MASS), switchOn)).toBe(false);
    expect(canEngulf(traitless, prey(PREY_MASS), balance)).toBe(true);
  });

  it('keeps the ratio rule past the switch: a cell with the Lattice under the bound cannot start', () => {
    const bound = engulfStartMass(prey(PREY_MASS), switchOn);
    expect(canEngulf(predator(bound - JUST_UNDER, null, ['cytoskeleton']), prey(PREY_MASS), switchOn)).toBe(false);
    expect(canEngulf(predator(bound, null, ['cytoskeleton']), prey(PREY_MASS), switchOn)).toBe(true);
  });
});

describe('meetsEngulfStartRatio (the mass half of canEngulf)', () => {
  it('holds at the exact start bound and fails just under it, the Cell Wall bonus included', () => {
    const bound = walledBound(balance.ENGULF_MASS_RATIO);
    expect(meetsEngulfStartRatio({ mass: bound }, prey(PREY_MASS, CELL_WALL_ONE_BONUS), balance)).toBe(true);
    expect(meetsEngulfStartRatio({ mass: bound - JUST_UNDER }, prey(PREY_MASS, CELL_WALL_ONE_BONUS), balance)).toBe(
      false,
    );
  });

  it('ignores the swallow switch: a cell without the gate trait meets the ratio that its traits still forbid', () => {
    expect(meetsEngulfStartRatio({ mass: HEAVY_PREDATOR_MASS }, prey(PREY_MASS), switchOn)).toBe(true);
    expect(canEngulf(predator(HEAVY_PREDATOR_MASS), prey(PREY_MASS), switchOn)).toBe(false);
  });
});

describe('canContinueEngulf (canContinue, hysteresis)', () => {
  it('holds between the release and the required ratio: 23 vs 20 continues but cannot start (E16)', () => {
    expect(canContinueEngulf({ mass: 23 }, prey(20), balance)).toBe(true);
    expect(canEngulf(predator(23), prey(20), balance)).toBe(false);
  });

  it('holds at exactly the release ratio: 22 vs 20', () => {
    expect(canContinueEngulf({ mass: 22 }, prey(20), balance)).toBe(true);
  });

  it('releases under it: 21.5 vs 20 (E16 tick 20)', () => {
    expect(canContinueEngulf({ mass: 21.5 }, prey(20), balance)).toBe(false);
  });

  it('adds the Cell Wall bonus: the exact (release ratio + Cell Wall I) × 20 bound holds, just under releases (T3)', () => {
    const bound = walledBound(balance.ENGULF_RELEASE_RATIO);
    expect(canContinueEngulf({ mass: bound }, prey(PREY_MASS, CELL_WALL_ONE_BONUS), balance)).toBe(true);
    expect(canContinueEngulf({ mass: bound - JUST_UNDER }, prey(PREY_MASS, CELL_WALL_ONE_BONUS), balance)).toBe(false);
  });

  it('is never stricter than canEngulf', () => {
    for (const mass of [20, 22, 24, 25, 30, 100]) {
      if (canEngulf(predator(mass), prey(20), balance))
        expect(canContinueEngulf({ mass }, prey(20), balance)).toBe(true);
    }
  });
});

/** A prey that rolls every wrapped and sealed tick: TRAITS T4's Diatom Shell I, 0.4/s over 60 ticks. */
const SPINY_CHANCE_PER_TICK = 0.4 / 60;

describe('resolveEngulfHold', () => {
  const holding = { phase: ENGULF_PHASE.wrap, spitOutRoll: null, spitOutChancePerTick: 0 };

  it('holds while the predator is above the release ratio (E16: 23 holds 20)', () => {
    expect(resolveEngulfHold({ mass: 23 }, prey(20), holding, balance)).toBe(ENGULF_HOLD);
  });

  it('releases on the ratio below it, in any phase (E16b: sealed and still released)', () => {
    const sealed = { ...holding, phase: ENGULF_PHASE.absorb };
    expect(resolveEngulfHold({ mass: 21.5 }, prey(20), sealed, balance)).toBe(ENGULF_RELEASE_REASON.ratio);
  });

  it('spits the prey out when the roll lands under the chance (T4)', () => {
    const draw = { phase: ENGULF_PHASE.wrap, spitOutRoll: 0.001, spitOutChancePerTick: SPINY_CHANCE_PER_TICK };
    expect(resolveEngulfHold({ mass: 100 }, prey(20), draw, balance)).toBe(ENGULF_RELEASE_REASON.spatOut);
  });

  it('holds when the roll misses', () => {
    const draw = { phase: ENGULF_PHASE.wrap, spitOutRoll: 0.5, spitOutChancePerTick: SPINY_CHANCE_PER_TICK };
    expect(resolveEngulfHold({ mass: 100 }, prey(20), draw, balance)).toBe(ENGULF_HOLD);
  });

  it('never spits out during cover, even with a roll that would hit', () => {
    const draw = { phase: ENGULF_PHASE.cover, spitOutRoll: 0, spitOutChancePerTick: SPINY_CHANCE_PER_TICK };
    expect(resolveEngulfHold({ mass: 100 }, prey(20), draw, balance)).toBe(ENGULF_HOLD);
  });

  it('answers the ratio before the spit-out, so a lost hold never spends a roll', () => {
    const draw = { phase: ENGULF_PHASE.wrap, spitOutRoll: 0, spitOutChancePerTick: SPINY_CHANCE_PER_TICK };
    expect(resolveEngulfHold({ mass: 21 }, prey(20), draw, balance)).toBe(ENGULF_RELEASE_REASON.ratio);
  });
});
