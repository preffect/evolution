// Runs a recording back (docs/DETERMINISM.md §6): a fresh world from the recorded seed, config,
// balance and roster, then tick by tick the joins and leaves, the debug patches and the inputs
// the recording stamped for that tick, each fed exactly the way the module fed them, and the
// same step, then the events stamped for the tick after the last one (what was pending when the
// recording was exported: they are already in `finalHash`). Callers compare the returned hash
// with `recording.finalHash`. The log is bucketed by tick once (`index-by-tick.ts`, the fold the
// scenario framework's replay shares). Within one tick the order is membership, then debug
// patches, then inputs, not arrival order (docs/DETERMINISM.md §8, #180).

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
  REPLAY_ORIGIN,
  type Replay,
  type ReplayDebugPatch,
  type ReplayInput,
  type ReplayMembershipEvent,
} from './replay-format.js';

export interface ReplayResult {
  readonly world: WorldState;
  readonly hash: StateHash;
}

/** A recording that no fresh world can reproduce: one opened by `debug_set_seed` (docs/DETERMINISM.md §6). */
export class ReplayOriginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReplayOriginError';
  }
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
  if (recording.startedBy === REPLAY_ORIGIN.reseed) {
    throw new ReplayOriginError(
      `a recording opened by debug_set_seed (seed ${recording.seed} at tick ${recording.startTick}) records a world that kept running and cannot be rebuilt from scratch`,
    );
  }
  const world = createWorld({
    seed: recording.seed,
    config: recording.config,
    balance: structuredClone(recording.balance),
    players: recording.roster,
    startTick: recording.startTick,
    nextEntityNumber: recording.nextEntityNumber,
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
  feedStep(world, log, recording.finalTick + 1, rejections);
  return { world, hash: computeStateHash(world) };
}
