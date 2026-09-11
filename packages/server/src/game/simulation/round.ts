// Step 2 (docs/GAME-DESIGN.md §5.4, docs/ECOLOGY.md §3.1): the round timer, the world level-up
// effect, the results phase that freezes steps 3–9, and the automatic rematch that rebuilds the
// world from `seed + ROUND_SEED_INCREMENT` with everyone present as a level-1 protocell
// (docs/DETERMINISM.md §3). The phase flips on the tick the timer reaches zero; the results
// screen ends on the tick its elapsed count reaches its length.

import { EFFECT_KIND, ROUND_PHASE } from '@evolution/shared';
import { createWorld } from '../world/create-world.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import {
  resultsDurationTicks,
  resultsElapsedTicksAt,
  roundDurationTicks,
  roundElapsedTicksAt,
  roundTimeLeftMsAt,
  worldReferenceAt,
} from './round-clock.js';

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
  // The tick's effects array stays the one the step context aliases (`step.ts`).
  fresh.effects = world.effects;
  Object.assign(world, fresh);
}

/**
 * The world clock crossed a whole level on this tick when the tick in progress reads a higher
 * `floor(worldLevel)` than the tick before it (docs/ECOLOGY.md §3.1: 10 800, 21 600, 32 400 in a
 * 600 s round). The cap freezes the clock through `results`, so no level-up fires there.
 */
export function emitWorldLevelUp(world: WorldState, context: StepContext): void {
  const previous = Math.floor(worldReferenceAt(world, world.tick - 1).worldLevel);
  const current = worldReferenceAt(world, world.tick);
  if (Math.floor(current.worldLevel) > previous) {
    context.effects.push({
      kind: EFFECT_KIND.worldLevelUp,
      tick: world.tick,
      level: Math.floor(current.worldLevel),
      stage: current.worldStage,
    });
  }
}

function advanceResults(world: WorldState, context: StepContext): RoundStepOutcome {
  if (resultsElapsedTicksAt(world, world.tick) < resultsDurationTicks(context.balance)) {
    return ROUND_STEP_OUTCOME.results;
  }
  resetWorldForRematch(world, context);
  return ROUND_STEP_OUTCOME.rematched;
}

export function advanceRound(world: WorldState, context: StepContext): RoundStepOutcome {
  if (world.roundPhase === ROUND_PHASE.results) {
    return advanceResults(world, context);
  }
  world.roundTimeLeftMs = roundTimeLeftMsAt(world, world.tick);
  emitWorldLevelUp(world, context);
  if (roundElapsedTicksAt(world, world.tick) < roundDurationTicks(world)) {
    return ROUND_STEP_OUTCOME.playing;
  }
  world.roundPhase = ROUND_PHASE.results;
  return ROUND_STEP_OUTCOME.results;
}
