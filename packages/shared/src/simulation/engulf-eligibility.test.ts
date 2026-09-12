// docs/ECOLOGY.md §6.1 and the boundary rows of its scenarios: E10 (exact ratio), E16
// (hysteresis) and TRAITS T3 (the Cell Wall bonus). Cell views are reduced to what the
// predicates read; the numbers are the design's.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { ENGULF_RELEASE_REASON } from '../types/effects.js';
import { ENGULF_HOLD, canContinueEngulf, canEngulf, resolveEngulfHold, type EngulfPrey } from './engulf-eligibility.js';
import { ENGULF_PHASE } from './engulf-pace.js';

const balance = DEFAULT_BALANCE.absorption;
/** Cell Wall I's bonus as the catalog declares it (TRAITS §3.3), so T3 tracks a retune. */
const CELL_WALL_ONE_BONUS = DEFAULT_BALANCE.traits.TRAIT_TIERS.cell_wall[0].membraneRatioBonus ?? 0;
const PREY_MASS = 20;
const JUST_UNDER = 0.01;
/** The exact bound of T3 for a walled prey: `PREY_MASS × (ratio + Cell Wall I)`, computed as the predicate does. */
const walledBound = (ratio: number): number => PREY_MASS * (ratio + CELL_WALL_ONE_BONUS);

const prey = (mass: number, membraneRatioBonus = 0): EngulfPrey => ({ mass, membraneRatioBonus });

describe('canEngulf (canStart)', () => {
  it('holds at exactly the required ratio: 25 vs 20 (E10)', () => {
    expect(canEngulf({ mass: 25 }, prey(20), balance)).toBe(true);
  });

  it('fails one unit under it: 24 vs 20 (E10)', () => {
    expect(canEngulf({ mass: 24 }, prey(20), balance)).toBe(false);
  });

  it('never holds both ways: near-equal cells only push apart', () => {
    expect(canEngulf({ mass: 21 }, prey(20), balance)).toBe(false);
    expect(canEngulf({ mass: 20 }, prey(21), balance)).toBe(false);
  });

  it('adds the Cell Wall bonus of the prey: the exact (ratio + Cell Wall I) × 20 bound holds, just under fails (T3)', () => {
    const bound = walledBound(balance.ENGULF_MASS_RATIO);
    expect(CELL_WALL_ONE_BONUS).toBeGreaterThan(0);
    expect(canEngulf({ mass: bound }, prey(PREY_MASS, CELL_WALL_ONE_BONUS), balance)).toBe(true);
    expect(canEngulf({ mass: bound - JUST_UNDER }, prey(PREY_MASS, CELL_WALL_ONE_BONUS), balance)).toBe(false);
  });

  it("ignores the predator's own membrane bonus", () => {
    expect(canEngulf({ mass: 25, membraneRatioBonus: 1 } as EngulfPrey, prey(20), balance)).toBe(true);
  });

  it('reads the ratio from the balance it is given, not from a module constant', () => {
    const lenient = structuredClone(balance);
    lenient.ENGULF_MASS_RATIO = 1;
    expect(canEngulf({ mass: 20 }, prey(20), lenient)).toBe(true);
  });
});

describe('canContinueEngulf (canContinue, hysteresis)', () => {
  it('holds between the release and the required ratio: 23 vs 20 continues but cannot start (E16)', () => {
    expect(canContinueEngulf({ mass: 23 }, prey(20), balance)).toBe(true);
    expect(canEngulf({ mass: 23 }, prey(20), balance)).toBe(false);
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
      if (canEngulf({ mass }, prey(20), balance)) expect(canContinueEngulf({ mass }, prey(20), balance)).toBe(true);
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
