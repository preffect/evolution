// docs/PROGRESSION.md §2: the threshold table, row by row, and its cumulative column.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { levelUpCost } from './level-costs.js';

const balance = DEFAULT_BALANCE.progression;

/** [level reached, cost from the previous level, cumulative DNA]. */
const THRESHOLD_TABLE: readonly [number, number, number][] = [
  [2, 20, 20],
  [3, 30, 50],
  [4, 40, 90],
  [5, 50, 140],
  [6, 60, 200],
  [7, 70, 270],
  [8, 80, 350],
  [9, 90, 440],
  [10, 100, 540],
  [11, 110, 650],
  [12, 120, 770],
];

describe('levelUpCost', () => {
  it.each(THRESHOLD_TABLE)('reaching level %i costs %i DNA from the level before', (levelReached, cost) => {
    expect(levelUpCost(levelReached - 1, balance)).toBe(cost);
  });

  it.each(THRESHOLD_TABLE)('reaching level %i takes %i cumulative DNA (%i)', (levelReached, _cost, cumulative) => {
    let total = 0;
    for (let level = 1; level < levelReached; level += 1) total += levelUpCost(level, balance);
    expect(total).toBe(cumulative);
  });

  it('reaches the maximum level at 770 DNA, so P10 stays at level 12 with 775', () => {
    let total = 0;
    for (let level = 1; level < balance.MAX_LEVEL; level += 1) total += levelUpCost(level, balance);
    expect(total).toBe(770);
  });

  it('reads its coefficients from the balance it is given', () => {
    const custom = structuredClone(balance);
    custom.LEVEL_UP_COST_BASE_DNA = 5;
    custom.LEVEL_UP_COST_PER_LEVEL_DNA = 1;
    expect(levelUpCost(1, custom)).toBe(6);
  });
});
