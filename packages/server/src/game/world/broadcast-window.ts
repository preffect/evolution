// The one drain of a broadcast window (docs/architecture/entity-model.md §2, docs/architecture/wire-contract.md §4
// "Mass flow"): the effects since the last drain and the sprint spend they belong with leave together, so no caller
// can take one without the other. The broadcast (`serializeDeltaSnapshot`) and the scenario adapter (every tick) are
// its callers; a transient added beside the effects is drained here too.

import type { GameEffect } from '@evolution/shared';
import { sealSprintWindow } from './mass-flow-ledger.js';
import type { WorldState } from './world-state.js';

/** Takes the window's effects (the world keeps its array, emptied) and seals the window's sprint spend. */
export function drainBroadcastWindow(world: WorldState): GameEffect[] {
  sealSprintWindow(world.massFlow);
  return world.effects.splice(0);
}
