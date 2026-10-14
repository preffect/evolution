// The move's grace (docs/game-design/phases.md §14.4.2 step 8): for `ERA_MOVE_GRACE_SECONDS` after the pool's move no
// pool creature or wild cell chooses a player as a target, and no engulf of a player cell starts, whoever the predator
// (players included). Cells may still bump. The grace is stored world state, a tick the move sets
// (`WorldState.moveGraceEndsAtTick`, hashed in the eras' section), never derived from the clock.

import { secondsToTicks, type BalanceConfig } from '@evolution/shared';
import { isPlayerCell, type CellRecord } from '../world/entities.js';
import type { WorldState } from '../world/world-state.js';

/** What the grace reads of the world: the tick being stepped and the grace's end. */
export type MoveGraceWorld = Pick<WorldState, 'tick' | 'moveGraceEndsAtTick'>;

/** Step 8 of the pool's move: the grace covers this tick and the next `ERA_MOVE_GRACE_SECONDS` × 60 − 1. */
export function startMoveGrace(world: WorldState, balance: BalanceConfig): void {
  world.moveGraceEndsAtTick = world.tick + secondsToTicks(balance.eras.ERA_MOVE_GRACE_SECONDS);
}

/** True while the move's grace covers the tick being stepped. */
export function isMoveGraceOn(world: MoveGraceWorld): boolean {
  return world.moveGraceEndsAtTick !== null && world.tick < world.moveGraceEndsAtTick;
}

/** True when the grace spares `cell` this tick: a player's cell, while the grace is on. */
export function isSparedByMoveGrace(world: MoveGraceWorld, cell: CellRecord): boolean {
  return isPlayerCell(cell) && isMoveGraceOn(world);
}
