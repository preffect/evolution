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
