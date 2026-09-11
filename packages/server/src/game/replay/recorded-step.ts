// One module tick with its recording (docs/DETERMINISM.md §6): the pending inputs are logged as
// what step 1 applies, the world is stepped, and a rematch (the seed moved, docs/GAME-DESIGN.md
// §5.4) closes the recording and opens the next round's. Returns the tick's effects for the
// broadcast window the module accumulates.

import type { GameEffect } from '@evolution/shared';
import { runStep } from '../simulation/step.js';
import type { InputRejectionCounters, WorldState } from '../world/world-state.js';
import type { ReplayRecorder } from './replay-recorder.js';

export function runRecordedStep(
  world: WorldState,
  recorder: ReplayRecorder,
  rejections: InputRejectionCounters,
): readonly GameEffect[] {
  recorder.recordPendingInputs(world);
  const seedBefore = world.seed;
  runStep(world, world.balance, rejections);
  if (world.seed !== seedBefore) {
    recorder.startNewRound(world);
  }
  return world.effects;
}
