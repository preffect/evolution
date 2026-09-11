// One module tick with its recording (docs/DETERMINISM.md §6): the pending inputs are logged as
// what step 1 applies, the world is stepped, and a rematch (the seed moved, docs/GAME-DESIGN.md
// §5.4) closes the recording at the rematch tick with the rebuilt world's hash and opens the
// next round's. The tick's effects stay in `world.effects` for the broadcast to drain.

import { runStep } from '../simulation/step.js';
import type { InputRejectionCounters, WorldState } from '../world/world-state.js';
import { REPLAY_ORIGIN } from './replay-format.js';
import type { ReplayRecorder } from './replay-recorder.js';

export function runRecordedStep(world: WorldState, recorder: ReplayRecorder, rejections: InputRejectionCounters): void {
  recorder.recordPendingInputs(world);
  const seedBefore = world.seed;
  runStep(world, world.balance, rejections);
  if (world.seed !== seedBefore) {
    recorder.startNewRound(world, REPLAY_ORIGIN.rematch);
  }
}
