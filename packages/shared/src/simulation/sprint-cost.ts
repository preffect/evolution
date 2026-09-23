// The mass a sprint start takes (docs/game-design/controls-and-scope.md §6): `SPRINT_MASS_COST_FRACTION` of the
// mass, floored at `CELL_STARTING_MASS`. Shared so the HUD names the same amount the server charges
// (docs/ui/hud.md §3.1.5, #383). The server writes `massAfterSprint`; `sprintMassCost` is the difference, so the
// two never round apart.

import type { BalanceConfig } from '../constants/balance.js';
import { secondsToTicks } from '../time/units.js';

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

/** The rows a sprint's timing reads. */
export interface SprintTimingBalance {
  readonly controls: Pick<BalanceConfig['controls'], 'SPRINT_COOLDOWN_SECONDS' | 'SPRINT_DURATION_SECONDS'>;
  readonly traits: Pick<BalanceConfig['traits'], 'SPRINT_COOLDOWN_FLOOR_SECONDS'>;
}

/** Ticks a sprint runs for once started. */
export function sprintDurationTicks(balance: SprintTimingBalance): number {
  return secondsToTicks(balance.controls.SPRINT_DURATION_SECONDS);
}

/**
 * The cooldown a sprint starts with: `SPRINT_COOLDOWN_SECONDS + delta`, floored (docs/traits/model.md §2). Shared so
 * the client's prediction starts the sprint the server will (docs/architecture/client.md §5).
 */
export function sprintCooldownTicksFor(sprintCooldownSecondsDelta: number, balance: SprintTimingBalance): number {
  const seconds = Math.max(
    balance.controls.SPRINT_COOLDOWN_SECONDS + sprintCooldownSecondsDelta,
    balance.traits.SPRINT_COOLDOWN_FLOOR_SECONDS,
  );
  return secondsToTicks(seconds);
}
