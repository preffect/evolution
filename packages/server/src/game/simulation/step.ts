// One tick (docs/ARCHITECTURE.md §3): the fixed step order every scenario table assumes
// (docs/DETERMINISM.md §1). `stepWorld` mutates the world in place and returns what happened to
// the round; `runStep` wraps it with the one resume-and-write-back of the random streams.
//
//   1 inputs      2 round      3 movement (+ separation, pins)   4 eating   5 metabolism
//   6 engulf      7 progression      8 spawners + mote motion
//   9 respawn     10 leaderboard

import { ROUND_PHASE, type BalanceConfig } from '@evolution/shared';
import { runProgression } from '../progression/levels.js';
import { updateLeaderboard } from '../session/leaderboard.js';
import { runRespawns } from '../session/respawn.js';
import { resumeStreams, storeStreams } from '../world/streams.js';
import type { InputRejectionCounters, StepContext, WorldState } from '../world/world-state.js';
import { eat } from './eating.js';
import { abortAllEngulfs, runEngulfs } from './engulf.js';
import { applyInputs } from './inputs.js';
import { metabolise } from './metabolism.js';
import { moveMotes } from './mote-motion.js';
import { moveCells } from './movement.js';
import { advanceRound, ROUND_STEP_OUTCOME, type RoundStepOutcome } from './round.js';
import { runSpawners } from './spawner.js';

export function stepWorld(world: WorldState, context: StepContext): RoundStepOutcome {
  world.tick += 1;
  if (world.roundPhase === ROUND_PHASE.playing) {
    applyInputs(world, context); // input is ignored through `results` (docs/GAME-DESIGN.md §5.4)
  }
  const outcome = advanceRound(world, context);
  if (outcome === ROUND_STEP_OUTCOME.rematched) {
    return outcome;
  }
  if (world.roundPhase === ROUND_PHASE.results) {
    abortAllEngulfs(world); // no payout in results (docs/ECOLOGY.md §6.3, E13); a no-op on later results ticks
    updateLeaderboard(world);
    return outcome;
  }
  moveCells(world, context);
  eat(world, context);
  metabolise(world, context);
  runEngulfs(world, context);
  runProgression(world, context);
  runSpawners(world, context);
  moveMotes(world, context);
  runRespawns(world, context);
  updateLeaderboard(world);
  return outcome;
}

/**
 * The step as the module runs it: streams resumed from `world.random`, the world stepped, the
 * streams written back. A rematch rebuilt the world with fresh streams, so nothing is written
 * back over them. Effects accumulate in `world.effects` (a join or a debug grant between ticks
 * pushes there too) until the module's broadcast drains them; the step never clears them.
 */
export function runStep(world: WorldState, balance: BalanceConfig, rejections: InputRejectionCounters): void {
  const streams = resumeStreams(world);
  const context: StepContext = { balance, streams, effects: world.effects, rejections };
  const outcome = stepWorld(world, context);
  if (outcome !== ROUND_STEP_OUTCOME.rematched) {
    storeStreams(world, streams);
  }
}
