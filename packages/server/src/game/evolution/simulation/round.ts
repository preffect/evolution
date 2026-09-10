// Step 2 (docs/GAME-DESIGN.md §5.4): the round timer, the results phase that freezes steps 3–9,
// and the automatic rematch that rebuilds the world from `seed + ROUND_SEED_INCREMENT` with
// everyone present as a level-1 protocell (docs/DETERMINISM.md §3). The phase flips on the tick
// the timer reaches zero; the results screen ends on the tick its elapsed count reaches its length.

import { ROUND_PHASE } from '@evolution/shared';
import { createWorld } from '../world/create-world.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { resultsDurationTicks, roundDurationTicks, roundTimeLeftMs } from './round-clock.js';

export const ROUND_STEP_OUTCOME = { playing: 'playing', results: 'results', rematched: 'rematched' } as const;
export type RoundStepOutcome = (typeof ROUND_STEP_OUTCOME)[keyof typeof ROUND_STEP_OUTCOME];

/** Rebuilds the world in place for the next round: new seed, same roster, continued tick and ids. */
export function resetWorldForRematch(world: WorldState, context: StepContext): void {
  const fresh = createWorld({
    seed: world.seed + context.balance.session.ROUND_SEED_INCREMENT,
    config: world.config,
    balance: world.balance,
    players: world.players.map(({ playerId, playerName, avatarIndex }) => ({ playerId, playerName, avatarIndex })),
    startTick: world.tick,
    nextEntityNumber: world.nextEntityNumber,
  });
  Object.assign(world, fresh);
}

function advanceResults(world: WorldState, context: StepContext): RoundStepOutcome {
  world.resultsElapsedTicks += 1;
  if (world.resultsElapsedTicks < resultsDurationTicks(context.balance)) {
    return ROUND_STEP_OUTCOME.results;
  }
  resetWorldForRematch(world, context);
  return ROUND_STEP_OUTCOME.rematched;
}

export function advanceRound(world: WorldState, context: StepContext): RoundStepOutcome {
  if (world.roundPhase === ROUND_PHASE.results) {
    return advanceResults(world, context);
  }
  world.roundElapsedTicks += 1;
  world.roundTimeLeftMs = roundTimeLeftMs(world);
  if (world.roundElapsedTicks < roundDurationTicks(world)) {
    return ROUND_STEP_OUTCOME.playing;
  }
  world.roundPhase = ROUND_PHASE.results;
  world.resultsElapsedTicks = 0;
  return ROUND_STEP_OUTCOME.results;
}
