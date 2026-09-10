// Records what the simulation saw (docs/DETERMINISM.md §6): joins, leaves, the coalesced inputs
// step 1 applies and the debug patches, each stamped with the tick they apply at. One replay is
// one round: the rematch and `debug_set_seed` close the recording and start a new one from the
// new seed.

import { REPLAY_FORMAT_VERSION, type PlayerId, type StateHash } from '@evolution/shared';
import type { DebugPatch } from '../debug/debug-operations.js';
import type { PlayerIdentity } from '../session/players.js';
import { computeStateHash } from '../world/state-hash.js';
import type { WorldState } from '../world/world-state.js';
import {
  REPLAY_MEMBERSHIP_KIND,
  type Replay,
  type ReplayDebugPatch,
  type ReplayInput,
  type ReplayMembershipEvent,
} from './replay-format.js';

/** The mutable half of a recording; `export()` freezes it into a `Replay` with the final hash. */
interface OpenRecording {
  seed: number;
  startTick: number;
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

function openRecording(world: WorldState): OpenRecording {
  return {
    seed: world.seed,
    startTick: world.tick,
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
    this.current = openRecording(world);
  }

  /** Called right before the step: every pending input is what step 1 applies at `tick + 1`. */
  recordPendingInputs(world: WorldState): void {
    for (const player of world.players) {
      if (player.pendingInput !== null) {
        this.current.inputs.push({ tick: world.tick + 1, playerId: player.playerId, input: player.pendingInput });
      }
    }
  }

  recordJoin(world: WorldState, identity: PlayerIdentity): void {
    this.current.membership.push({ ...identityOf(identity), tick: world.tick + 1, kind: REPLAY_MEMBERSHIP_KIND.join });
  }

  recordLeave(world: WorldState, playerId: PlayerId): void {
    const player = world.players.find((candidate) => candidate.playerId === playerId);
    const identity: PlayerIdentity = player ? identityOf(player) : { playerId, playerName: playerId, avatarIndex: 0 };
    this.current.membership.push({ ...identity, tick: world.tick + 1, kind: REPLAY_MEMBERSHIP_KIND.leave });
  }

  recordDebugPatch(world: WorldState, patch: DebugPatch): void {
    this.current.debugPatches.push({ tick: world.tick + 1, patch });
  }

  /**
   * Closes the current recording at the world's tick and starts a fresh one from the world as it
   * is now. `closingHash` is the hash of the last tick before the reset when the caller has it
   * (a reseed hashes before it rebuilds the streams); by default the world's hash now.
   */
  startNewRound(world: WorldState, closingHash: StateHash = computeStateHash(world)): void {
    this.completedRounds.push(this.export(world, closingHash));
    this.current = openRecording(world);
  }

  /** The current round so far, ending at the world's tick and hash. */
  export(world: WorldState, finalHash: StateHash = computeStateHash(world)): Replay {
    const recording = this.current;
    return {
      version: REPLAY_FORMAT_VERSION,
      seed: recording.seed,
      startTick: recording.startTick,
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
