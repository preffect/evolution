// Records what the simulation saw (docs/DETERMINISM.md §6): joins, leaves, the coalesced inputs
// step 1 applies and the debug patches, each stamped with the tick they apply at. One replay is
// one round: the rematch and `debug_set_seed` close the recording and start a new one from the
// new seed.

import { REPLAY_FORMAT_VERSION, type StateHash } from '@evolution/shared';
import type { PlayerIdentity } from '../session/players.js';
import { computeStateHash } from '../world/state-hash.js';
import type { WorldState } from '../world/world-state.js';
import {
  REPLAY_MEMBERSHIP_KIND,
  REPLAY_ORIGIN,
  type DebugPatch,
  type Replay,
  type ReplayDebugPatch,
  type ReplayInput,
  type ReplayMembershipEvent,
  type ReplayOrigin,
} from './replay-format.js';

/** The mutable half of a recording; `export()` freezes it into a `Replay` with the final hash. */
interface OpenRecording {
  startedBy: ReplayOrigin;
  seed: number;
  startTick: number;
  nextEntityNumber: number;
  config: Replay['config'];
  balance: Replay['balance'];
  roster: PlayerIdentity[];
  membership: ReplayMembershipEvent[];
  inputs: ReplayInput[];
  debugPatches: ReplayDebugPatch[];
}

function identityOf(player: PlayerIdentity): PlayerIdentity {
  return { playerId: player.playerId, playerName: player.playerName, avatarIndex: player.avatarIndex };
}

/** The inputs step 1 will apply at `tick + 1`, stamped so. */
function pendingInputsOf(world: WorldState): ReplayInput[] {
  const inputs: ReplayInput[] = [];
  for (const player of world.players) {
    if (player.pendingInput !== null) {
      inputs.push({ tick: world.tick + 1, playerId: player.playerId, input: player.pendingInput });
    }
  }
  return inputs;
}

function openRecording(world: WorldState, startedBy: ReplayOrigin): OpenRecording {
  return {
    startedBy,
    seed: world.seed,
    startTick: world.tick,
    nextEntityNumber: world.roundFirstEntityNumber,
    config: world.config,
    balance: structuredClone(world.balance),
    roster: world.players.map(identityOf),
    membership: [],
    inputs: [],
    debugPatches: [],
  };
}

export class ReplayRecorder {
  readonly completedRounds: Replay[] = [];
  private current: OpenRecording;

  constructor(world: WorldState) {
    this.current = openRecording(world, REPLAY_ORIGIN.worldBuild);
  }

  /**
   * Called right before the step, and by `export`: every pending input is what step 1 applies at
   * `tick + 1`. The entries already stamped for that tick are replaced, so an export between ticks
   * and the step that follows it record the same fact once (an input coalesced after the export
   * replaces the earlier entry, as it replaced the pending slot).
   */
  recordPendingInputs(world: WorldState): void {
    const nextTick = world.tick + 1;
    this.current.inputs = this.current.inputs.filter((entry) => entry.tick !== nextTick);
    this.current.inputs.push(...pendingInputsOf(world));
  }

  recordJoin(world: WorldState, identity: PlayerIdentity): void {
    this.current.membership.push({ ...identityOf(identity), tick: world.tick + 1, kind: REPLAY_MEMBERSHIP_KIND.join });
  }

  /** The caller looks the identity up before removing the player: a leave is never invented. */
  recordLeave(world: WorldState, identity: PlayerIdentity): void {
    this.current.membership.push({ ...identityOf(identity), tick: world.tick + 1, kind: REPLAY_MEMBERSHIP_KIND.leave });
  }

  recordDebugPatch(world: WorldState, patch: DebugPatch): void {
    this.current.debugPatches.push({ tick: world.tick + 1, patch });
  }

  /**
   * Closes the current recording at the world's tick and starts a fresh one from the world as it
   * is now, marked by what opened it. `closingHash` is the hash of the last tick before the reset
   * when the caller has it (a reseed hashes before it rebuilds the streams); a rematch closes at
   * the rematch tick with the rebuilt world's hash.
   */
  startNewRound(world: WorldState, startedBy: ReplayOrigin, closingHash: StateHash = computeStateHash(world)): void {
    this.completedRounds.push(this.export(world, closingHash));
    this.current = openRecording(world, startedBy);
  }

  /**
   * The current round so far, ending at the world's tick and hash. An input still pending when
   * the export happens is already in that hash (`pendingInput` is hashed), so it rides along
   * stamped for the next tick, exactly as `recordPendingInputs` would stamp it.
   */
  export(world: WorldState, finalHash: StateHash = computeStateHash(world)): Replay {
    this.recordPendingInputs(world);
    const recording = this.current;
    return {
      version: REPLAY_FORMAT_VERSION,
      startedBy: recording.startedBy,
      seed: recording.seed,
      startTick: recording.startTick,
      nextEntityNumber: recording.nextEntityNumber,
      config: recording.config,
      balance: recording.balance,
      roster: [...recording.roster],
      membership: [...recording.membership],
      inputs: [...recording.inputs],
      debugPatches: [...recording.debugPatches],
      finalTick: world.tick,
      finalHash,
    };
  }
}
