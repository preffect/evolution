// `debug_set_era(gameId, era)` (docs/architecture/debug-mcp.md §8, docs/game-design/phases.md §14.2.4): jumps a round
// forward to a later era by moving `roundStartTick` back, so that the next step is that era's first tick. The tick
// counter never jumps (the replay log, the acks and the effect windows are keyed by it), so `roundStartTick` may go
// below zero. Recorded as a `debug_patch`, so a replay reproduces the hash across the jump. The next step runs the move
// into every era after the one the world has moved into, up to the clock's, in era order (server-simulation.md §3).

import {
  ROUND_PHASE,
  eraStartTicks,
  isEraAfter,
  isEraInPlay,
  isEraReachable,
  type EraClockBalance,
  type GameEra,
} from '@evolution/shared';
import { DebugRequestError } from './debug-request-error.js';
import { roundEraAt } from '../simulation/round-clock.js';
import type { WorldState } from '../world/world-state.js';

/** The next step runs at the tick after the world's: the tick the jump makes the era's first. */
const TICKS_TO_NEXT_STEP = 1;

/** What `debug_set_era` answers: the era the next step opens, that step's tick and the round start that makes it so. */
export interface EraJump {
  readonly era: GameEra;
  readonly firstTick: number;
  readonly roundStartTick: number;
}

/**
 * Refuses a balance patch that would take the round back to an earlier era (an era taken out of `ERAS_IN_PLAY`, or a
 * start moved past the round's time): an era, once opened, is never left (phases.md §14.2.4).
 */
export function refuseEraRewind(world: WorldState, patched: EraClockBalance): void {
  const before = roundEraAt(world, world.tick);
  const after = roundEraAt(world, world.tick, patched);
  if (isEraAfter(before, after)) {
    throw new DebugRequestError(`The patch would take the round back from "${before}" to "${after}"`);
  }
}

/** Refuses a jump the round cannot make: over, not in play, past the round's end, or not forward. */
function refuseEraJump(world: WorldState, era: GameEra): void {
  const { eras } = world.balance;
  if (world.roundPhase === ROUND_PHASE.results) {
    throw new DebugRequestError('The round is over: the next round starts in the dish');
  }
  if (!isEraInPlay(era, world.balance)) {
    throw new DebugRequestError(
      `"${era}" is not in play (ERAS_IN_PLAY is ${JSON.stringify(eras.ERAS_IN_PLAY)}): patch eras.ERAS_IN_PLAY first`,
    );
  }
  const roundDurationSeconds = world.config.roundDurationSeconds;
  if (!isEraReachable(era, roundDurationSeconds, world.balance)) {
    throw new DebugRequestError(
      `A round of ${roundDurationSeconds} s ends before "${era}" starts at ${eras.ERA_START_SECONDS[era]} s`,
    );
  }
  const current = roundEraAt(world, world.tick);
  if (!isEraAfter(era, current)) {
    throw new DebugRequestError(`The round is in "${current}": debug_set_era only moves to a later era`);
  }
}

/** Moves `roundStartTick` so the next step is `era`'s first tick; refuses with `DebugRequestError`, changing nothing. */
export function setEraForDebug(world: WorldState, era: GameEra): EraJump {
  refuseEraJump(world, era);
  const firstTick = world.tick + TICKS_TO_NEXT_STEP;
  world.roundStartTick = firstTick - eraStartTicks(era, world.balance);
  return { era, firstTick, roundStartTick: world.roundStartTick };
}
