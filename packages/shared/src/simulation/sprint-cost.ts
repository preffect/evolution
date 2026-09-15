// The mass a sprint start takes (docs/game-design/controls-and-scope.md §6): `SPRINT_MASS_COST_FRACTION` of the
// mass, floored at `CELL_STARTING_MASS`. Shared so the HUD names the same amount the server charges
// (docs/ui/hud.md §3.1.5, #383). The server writes `massAfterSprint`; `sprintMassCost` is the difference, so the
// two never round apart.

import type { BalanceConfig } from '../constants/balance.js';

/** The rows a sprint's cost reads. */
export interface SprintCostBalance {
  readonly controls: Pick<BalanceConfig['controls'], 'SPRINT_MASS_COST_FRACTION'>;
  readonly growth: Pick<BalanceConfig['growth'], 'CELL_STARTING_MASS'>;
}

/** The mass left after a sprint start from `mass`: `max(CELL_STARTING_MASS, mass × (1 − fraction))`. */
export function massAfterSprint(mass: number, balance: SprintCostBalance): number {
  return Math.max(balance.growth.CELL_STARTING_MASS, mass * (1 - balance.controls.SPRINT_MASS_COST_FRACTION));
}

/** `min(mass × fraction, mass − CELL_STARTING_MASS)`, never negative: a cell at the floor pays nothing. */
export function sprintMassCost(mass: number, balance: SprintCostBalance): number {
  return Math.max(0, mass - massAfterSprint(mass, balance));
}
