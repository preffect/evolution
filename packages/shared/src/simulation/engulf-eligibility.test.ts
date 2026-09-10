// docs/ECOLOGY.md §6.1 and the boundary rows of its scenarios: E10 (exact ratio), E16
// (hysteresis) and TRAITS T3 (the Cell Wall bonus). Cell views are reduced to what the
// predicates read; the numbers are the design's.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { canContinueEngulf, canEngulf, type EngulfPrey } from './engulf-eligibility.js';

const balance = DEFAULT_BALANCE.absorption;
const CELL_WALL_ONE_BONUS = 0.15;

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

  it('adds the Cell Wall bonus of the prey: 28 is the exact 1.40 × 20 bound (T3)', () => {
    expect(canEngulf({ mass: 28 }, prey(20, CELL_WALL_ONE_BONUS), balance)).toBe(true);
    expect(canEngulf({ mass: 27.99 }, prey(20, CELL_WALL_ONE_BONUS), balance)).toBe(false);
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

  it('adds the Cell Wall bonus: 25 is the exact 1.25 × 20 release bound for a walled prey (T3)', () => {
    expect(canContinueEngulf({ mass: 25 }, prey(20, CELL_WALL_ONE_BONUS), balance)).toBe(true);
    expect(canContinueEngulf({ mass: 24.99 }, prey(20, CELL_WALL_ONE_BONUS), balance)).toBe(false);
  });

  it('is never stricter than canEngulf', () => {
    for (const mass of [20, 22, 24, 25, 30, 100]) {
      if (canEngulf({ mass }, prey(20), balance)) expect(canContinueEngulf({ mass }, prey(20), balance)).toBe(true);
    }
  });
});
