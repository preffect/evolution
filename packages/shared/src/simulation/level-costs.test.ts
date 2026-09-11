// docs/PROGRESSION.md §2: the threshold table, row by row, and its cumulative column
// (decision #138 option A, "slow dawn").

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { cumulativeDnaForLevel, levelUpCost } from './level-costs.js';

const balance = DEFAULT_BALANCE.progression;

/** [level reached, cost from the previous level, cumulative DNA]. */
const THRESHOLD_TABLE: readonly [number, number, number][] = [
  [2, 60, 60],
  [3, 80, 140],
  [4, 100, 240],
  [5, 120, 360],
  [6, 140, 500],
  [7, 160, 660],
  [8, 180, 840],
  [9, 200, 1040],
  [10, 220, 1260],
  [11, 240, 1500],
  [12, 260, 1760],
];
/** Cumulative DNA at `MAX_LEVEL`: P10's "level 12 with fixture DNA 1760". */
const MAX_LEVEL_CUMULATIVE_DNA = 1760;

describe('levelUpCost', () => {
  it.each(THRESHOLD_TABLE)('reaching level %i costs %i DNA from the level before', (levelReached, cost) => {
    expect(levelUpCost(levelReached - 1, balance)).toBe(cost);
  });

  it.each(THRESHOLD_TABLE)('reaching level %i takes %i cumulative DNA (%i)', (levelReached, _cost, cumulative) => {
    expect(cumulativeDnaForLevel(levelReached, balance)).toBe(cumulative);
  });

  it(`reaches the maximum level at ${MAX_LEVEL_CUMULATIVE_DNA} DNA, so P10 stays at level 12 with 1760`, () => {
    expect(cumulativeDnaForLevel(balance.MAX_LEVEL, balance)).toBe(MAX_LEVEL_CUMULATIVE_DNA);
  });

  it('starts the ladder at zero cumulative DNA', () => {
    expect(cumulativeDnaForLevel(1, balance)).toBe(0);
  });

  it('reads its coefficients from the balance it is given', () => {
    const custom = structuredClone(balance);
    custom.LEVEL_UP_COST_BASE_DNA = 5;
    custom.LEVEL_UP_COST_PER_LEVEL_DNA = 1;
    expect(levelUpCost(1, custom)).toBe(6);
  });
});
