// Runs a recording back (docs/determinism/replay-tests-and-traps.md §6): a fresh world from the recorded seed, config,
// balance and roster, then tick by tick the events the recording stamped for that tick in log
// order (joins, leaves and debug patches as the room applied them, then the inputs), each fed
// exactly the way the module fed it, and the same step, then the events stamped for the tick
// after the last one (what was pending when the recording was exported: they are already in
// `finalHash`). Callers compare the returned hash with `recording.finalHash`. The log is bucketed
// by tick once (`index-by-tick.ts`, the fold the scenario framework's replay shares).

import { REPLAY_FORMAT_VERSION, type StateHash } from '@evolution/shared';
import { applyDebugPatch } from '../debug/debug-operations.js';
import { addPlayerToWorld, removePlayerFromWorld } from '../session/membership.js';
import { submitPlayerInput } from '../simulation/input-coalescing.js';
import { runStep } from '../simulation/step.js';
import { createWorld } from '../world/create-world.js';
import { computeStateHash } from '../world/state-hash.js';
import { createInputRejectionCounters, type InputRejectionCounters, type WorldState } from '../world/world-state.js';
import { indexByTick } from './index-by-tick.js';
import { REPLAY_EVENT_KIND, REPLAY_ORIGIN, type Replay, type ReplayEvent } from './replay-format.js';

export interface ReplayResult {
  readonly world: WorldState;
  readonly hash: StateHash;
}

/** A recording that no fresh world can reproduce: one opened by `debug_set_seed` (docs/determinism/replay-tests-and-traps.md §6). */
export class ReplayOriginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReplayOriginError';
  }
}

/** A recording in an older shape (docs/determinism/replay-tests-and-traps.md §6): it is refused, never guessed at. */
export class ReplayVersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReplayVersionError';
  }
}

function applyEvent(world: WorldState, event: ReplayEvent, rejections: InputRejectionCounters): void {
  switch (event.kind) {
    case REPLAY_EVENT_KIND.join:
      addPlayerToWorld(world, event, rejections);
      return;
    case REPLAY_EVENT_KIND.leave:
      removePlayerFromWorld(world, event.playerId);
      return;
    case REPLAY_EVENT_KIND.debugPatch:
      applyDebugPatch(world, event.patch);
      return;
    case REPLAY_EVENT_KIND.input:
      submitPlayerInput(world, event.playerId, event.input, rejections);
  }
}

function feedStep(
  world: WorldState,
  log: Map<number, ReplayEvent[]>,
  stepTick: number,
  rejections: InputRejectionCounters,
): void {
  for (const event of log.get(stepTick) ?? []) {
    applyEvent(world, event, rejections);
  }
}

function assertReplayable(recording: Replay): void {
  if (recording.version !== REPLAY_FORMAT_VERSION) {
    throw new ReplayVersionError(
      `a recording of format version ${recording.version} cannot be replayed by format version ${REPLAY_FORMAT_VERSION}`,
    );
  }
  if (recording.startedBy === REPLAY_ORIGIN.reseed) {
    throw new ReplayOriginError(
      `a recording opened by debug_set_seed (seed ${recording.seed} at tick ${recording.startTick}) records a world that kept running and cannot be rebuilt from scratch`,
    );
  }
}

export function replay(recording: Replay): ReplayResult {
  assertReplayable(recording);
  const world = createWorld({
    seed: recording.seed,
    config: recording.config,
    balance: structuredClone(recording.balance),
    players: recording.roster,
    startTick: recording.startTick,
    nextEntityNumber: recording.nextEntityNumber,
  });
  const log = indexByTick(recording.events);
  const rejections = createInputRejectionCounters();
  for (let stepTick = recording.startTick + 1; stepTick <= recording.finalTick; stepTick += 1) {
    feedStep(world, log, stepTick, rejections);
    runStep(world, world.balance, rejections);
  }
  feedStep(world, log, recording.finalTick + 1, rejections);
  return { world, hash: computeStateHash(world) };
}
