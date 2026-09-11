// The level threshold formula (docs/PROGRESSION.md §2), shared by the server's level-up step and
// the HUD's progress bar (docs/UI.md §3.1).

import type { BalanceConfig } from '../constants/balance.js';

/** The two coefficients, taken from `balance.progression`. */
export type LevelCostBalance = Pick<
  BalanceConfig['progression'],
  'LEVEL_UP_COST_BASE_DNA' | 'LEVEL_UP_COST_PER_LEVEL_DNA'
>;

/** DNA needed to go from `level` to `level + 1`. */
export function levelUpCost(level: number, balance: LevelCostBalance): number {
  return balance.LEVEL_UP_COST_BASE_DNA + balance.LEVEL_UP_COST_PER_LEVEL_DNA * level;
}

/** Cumulative DNA at which `level` is reached: the sum of every cost below it (0 at level 1). */
export function cumulativeDnaForLevel(level: number, balance: LevelCostBalance): number {
  let total = 0;
  for (let reached = 1; reached < level; reached += 1) total += levelUpCost(reached, balance);
  return total;
}
