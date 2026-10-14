// docs/ecology/absorption.md §6.1 and the boundary rows of its scenarios: E10 (exact ratio), E16
// (hysteresis) and TRAITS T3 (the Cell Wall bonus), and the swallow switch (docs/game-design/early-life.md §15.5.1).
// Cell views are reduced to what the predicates read; the numbers are the design's. The ratio cases state their swallow
// stage (`protocell`, §15.8.5) so they keep testing the ratio when the shipping switch flips.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { ENGULF_RELEASE_REASON } from '../types/effects.js';
import { STAGE_ORDER } from '../constants/ladder.js';
import { CELL_STAGE, GIANT_SPECIES, type CellStage, type GiantSpecies } from '../types/game.js';
import { withSwallowFromProtocell, withSwallowFromStage } from '../testing/swallow-balance.js';
import {
  ENGULF_HOLD,
  canContinueEngulf,
  canEngulf,
  engulfStartMass,
  isCellEaterSpecies,
  meetsEngulfStartRatio,
  resolveEngulfHold,
  type EngulfPredator,
  type EngulfPrey,
} from './engulf-eligibility.js';
import { ENGULF_PHASE } from './engulf-pace.js';

const balance = withSwallowFromProtocell().absorption;
/** The "early life on" slice's switch (early-life.md §15.10). */
const switchOn = withSwallowFromStage(CELL_STAGE.eukaryote).absorption;
/** Cell Wall I's bonus as the catalog declares it (traits/catalog-organelles.md §3.3), so T3 tracks a retune. */
const CELL_WALL_ONE_BONUS = DEFAULT_BALANCE.traits.TRAIT_TIERS.cell_wall[0].membraneRatioBonus ?? 0;
const PREY_MASS = 20;
const JUST_UNDER = 0.01;
/** The exact bound of T3 for a walled prey: `PREY_MASS × (ratio + Cell Wall I)`, computed as the predicate does. */
const walledBound = (ratio: number): number => PREY_MASS * (ratio + CELL_WALL_ONE_BONUS);

const prey = (mass: number, membraneRatioBonus = 0): EngulfPrey => ({ mass, membraneRatioBonus });
/** A player or plain wild protocell predator unless a giant species or a stage is given. */
const predator = (
  mass: number,
  giantSpecies: GiantSpecies | null = null,
  stage: CellStage = CELL_STAGE.protocell,
): EngulfPredator => ({ mass, giantSpecies, stage });
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

describe('canEngulf for the giant cells (docs/ecology/giants.md §3.5.6, acceptance G4)', () => {
  it('eats cells as a player or a plain wild cell, and as the giant hunter only', () => {
    expect(isCellEaterSpecies(null)).toBe(true);
    expect(isCellEaterSpecies(GIANT_SPECIES.amoeba)).toBe(true);
    expect(isCellEaterSpecies(GIANT_SPECIES.paramecium)).toBe(false);
    expect(isCellEaterSpecies(GIANT_SPECIES.diatom)).toBe(false);
  });

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

describe('canEngulf and the swallow switch (docs/game-design/early-life.md §15.5.1)', () => {
  it("ships at protocell: every stage swallows in the default balance, today's game exactly (§15.10)", () => {
    expect(DEFAULT_BALANCE.absorption.SWALLOW_FROM_STAGE).toBe(CELL_STAGE.protocell);
    for (const stage of STAGE_ORDER) {
      expect(canEngulf(predator(HEAVY_PREDATOR_MASS, null, stage), prey(PREY_MASS), DEFAULT_BALANCE.absorption)).toBe(
        true,
      );
    }
  });

  it('refuses a protocell player predator with the switch on and lets it swallow with the switch off', () => {
    const protocell = predator(HEAVY_PREDATOR_MASS, null, CELL_STAGE.protocell);
    expect(canEngulf(protocell, prey(PREY_MASS), switchOn)).toBe(false);
    expect(canEngulf(protocell, prey(PREY_MASS), balance)).toBe(true);
  });

  it('lets a player or plain wild cell swallow from the switch stage on, never below it', () => {
    const swallowIndex = STAGE_ORDER.indexOf(switchOn.SWALLOW_FROM_STAGE);
    for (const [index, stage] of STAGE_ORDER.entries()) {
      expect(canEngulf(predator(HEAVY_PREDATOR_MASS, null, stage), prey(PREY_MASS), switchOn)).toBe(
        index >= swallowIndex,
      );
    }
  });

  it.each(STAGE_ORDER)('lets the giant hunter swallow at %s with the switch on: its species decides', (stage) => {
    expect(canEngulf(predator(HEAVY_PREDATOR_MASS, GIANT_SPECIES.amoeba, stage), prey(PREY_MASS), switchOn)).toBe(true);
  });

  it('never lets the grazer or the drifter swallow, whatever the stage or the switch', () => {
    for (const species of [GIANT_SPECIES.paramecium, GIANT_SPECIES.diatom]) {
      for (const absorption of [balance, switchOn]) {
        expect(
          canEngulf(predator(HEAVY_PREDATOR_MASS, species, CELL_STAGE.specialised), prey(PREY_MASS), absorption),
        ).toBe(false);
      }
    }
  });

  it('keeps the ratio rule past the switch: a eukaryote under the bound cannot start', () => {
    const bound = engulfStartMass(prey(PREY_MASS), switchOn);
    expect(canEngulf(predator(bound - JUST_UNDER, null, CELL_STAGE.eukaryote), prey(PREY_MASS), switchOn)).toBe(false);
    expect(canEngulf(predator(bound, null, CELL_STAGE.eukaryote), prey(PREY_MASS), switchOn)).toBe(true);
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

  it('ignores the swallow switch: a protocell meets the ratio that its stage still forbids', () => {
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
