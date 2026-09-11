// Runs a recording back (docs/DETERMINISM.md §6): a fresh world from the recorded seed, config,
// balance and roster, then tick by tick the joins and leaves, the debug patches and the inputs
// the recording stamped for that tick, each fed exactly the way the module fed them, and the
// same step. Callers compare the returned hash with `recording.finalHash`. The log is bucketed
// by tick once (`index-by-tick.ts`, the fold the scenario framework's replay shares).

import type { StateHash } from '@evolution/shared';
import { applyDebugPatch } from '../debug/debug-operations.js';
import { addPlayerToWorld, removePlayerFromWorld } from '../session/membership.js';
import { submitPlayerInput } from '../simulation/input-coalescing.js';
import { runStep } from '../simulation/step.js';
import { createWorld } from '../world/create-world.js';
import { computeStateHash } from '../world/state-hash.js';
import { createInputRejectionCounters, type InputRejectionCounters, type WorldState } from '../world/world-state.js';
import { indexByTick } from './index-by-tick.js';
import {
  REPLAY_MEMBERSHIP_KIND,
  type Replay,
  type ReplayDebugPatch,
  type ReplayInput,
  type ReplayMembershipEvent,
} from './replay-format.js';

export interface ReplayResult {
  readonly world: WorldState;
  readonly hash: StateHash;
}

interface IndexedLog {
  readonly membership: Map<number, ReplayMembershipEvent[]>;
  readonly debugPatches: Map<number, ReplayDebugPatch[]>;
  readonly inputs: Map<number, ReplayInput[]>;
}

function applyMembership(
  world: WorldState,
  events: readonly ReplayMembershipEvent[],
  rejections: InputRejectionCounters,
): void {
  for (const event of events) {
    if (event.kind === REPLAY_MEMBERSHIP_KIND.join) {
      addPlayerToWorld(world, event, rejections);
    } else {
      removePlayerFromWorld(world, event.playerId);
    }
  }
}

function feedStep(world: WorldState, log: IndexedLog, stepTick: number, rejections: InputRejectionCounters): void {
  applyMembership(world, log.membership.get(stepTick) ?? [], rejections);
  for (const recorded of log.debugPatches.get(stepTick) ?? []) {
    applyDebugPatch(world, recorded.patch);
  }
  for (const recorded of log.inputs.get(stepTick) ?? []) {
    submitPlayerInput(world, recorded.playerId, recorded.input, rejections);
  }
}

export function replay(recording: Replay): ReplayResult {
  const world = createWorld({
    seed: recording.seed,
    config: recording.config,
    balance: structuredClone(recording.balance),
    players: recording.roster,
    startTick: recording.startTick,
  });
  const log: IndexedLog = {
    membership: indexByTick(recording.membership),
    debugPatches: indexByTick(recording.debugPatches),
    inputs: indexByTick(recording.inputs),
  };
  const rejections = createInputRejectionCounters();
  for (let stepTick = recording.startTick + 1; stepTick <= recording.finalTick; stepTick += 1) {
    feedStep(world, log, stepTick, rejections);
    runStep(world, world.balance, rejections);
  }
  return { world, hash: computeStateHash(world) };
}
