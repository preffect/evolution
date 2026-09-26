// The module's replay record (docs/determinism/replay-tests-and-traps.md §6): everything a round's simulation saw,
// stamped with the tick it was applied at. Beyond the doc's shape it carries `startTick` (the
// tick counter continues across a rematch) and `roster` (who was present when the recording
// started), both needed to rebuild the world the recording started from.

import type { BalanceConfig, GameInput, GameSessionConfig, PlayerId, StateHash } from '@evolution/shared';
import type { BalancePatch, DnaGrant, PlayerPatch, SpawnRequest } from '../debug/simulation-debug-handle.js';
import type { PlayerIdentity } from '../session/players.js';

/** The debug mutations a recording carries (docs/architecture/debug-mcp.md §8): the recording owns this vocabulary, `debug/` applies it. */
export const DEBUG_PATCH_KIND = {
  spawn: 'spawn',
  grantDna: 'grant_dna',
  setPlayer: 'set_player',
  setBalance: 'set_balance',
} as const;

export type DebugPatch =
  | { readonly kind: typeof DEBUG_PATCH_KIND.spawn; readonly request: SpawnRequest }
  | { readonly kind: typeof DEBUG_PATCH_KIND.grantDna; readonly playerId: PlayerId; readonly grant: DnaGrant }
  | { readonly kind: typeof DEBUG_PATCH_KIND.setPlayer; readonly playerId: PlayerId; readonly patch: PlayerPatch }
  | { readonly kind: typeof DEBUG_PATCH_KIND.setBalance; readonly patch: BalancePatch };

/**
 * What opened the recording: a world build (round start) and a rematch replay from scratch; a
 * `debug_set_seed` rebuilds only the streams of a running world, so its recording is exported for
 * inspection and never rebuilt by `replay()` (docs/determinism/replay-tests-and-traps.md §6).
 */
export const REPLAY_ORIGIN = { worldBuild: 'world_build', rematch: 'rematch', reseed: 'reseed' } as const;
export type ReplayOrigin = (typeof REPLAY_ORIGIN)[keyof typeof REPLAY_ORIGIN];

/** What one entry of the ordered log did (docs/determinism/replay-tests-and-traps.md §6). */
export const REPLAY_EVENT_KIND = { join: 'join', leave: 'leave', debugPatch: 'debug_patch', input: 'input' } as const;
export type ReplayEventKind = (typeof REPLAY_EVENT_KIND)[keyof typeof REPLAY_EVENT_KIND];

export interface ReplayMembershipEvent extends PlayerIdentity {
  /** The tick the event applies before (a join stamped 6000 is present for step 6000). */
  readonly tick: number;
  readonly kind: typeof REPLAY_EVENT_KIND.join | typeof REPLAY_EVENT_KIND.leave;
}

export interface ReplayDebugPatchEvent {
  readonly tick: number;
  readonly kind: typeof REPLAY_EVENT_KIND.debugPatch;
  readonly patch: DebugPatch;
}

export interface ReplayInputEvent {
  readonly tick: number;
  readonly kind: typeof REPLAY_EVENT_KIND.input;
  readonly playerId: PlayerId;
  /** The coalesced input step 1 applied at `tick`. */
  readonly input: GameInput;
}

/**
 * One entry of the log. Joins, leaves and debug patches sit in the order the room applied them;
 * a tick's inputs close its events, since an input only fills its own player's pending slot and
 * the log records that slot as step 1 read it.
 */
export type ReplayEvent = ReplayMembershipEvent | ReplayDebugPatchEvent | ReplayInputEvent;

export interface Replay {
  readonly version: number;
  readonly startedBy: ReplayOrigin;
  /** The round seed the recording started from. */
  readonly seed: number;
  readonly startTick: number;
  /** The entity counter at the start: a rematch continues it, so the rebuilt ids match (docs/determinism/replay-tests-and-traps.md §6). */
  readonly nextEntityNumber: number;
  readonly config: GameSessionConfig;
  /** The numbers the run used, so a live-tuned room still replays. */
  readonly balance: BalanceConfig;
  /** The players present when the recording started, in join order. */
  readonly roster: readonly PlayerIdentity[];
  /** Every event in the order the simulation saw it, each stamped with the tick it applies before. */
  readonly events: readonly ReplayEvent[];
  readonly finalTick: number;
  readonly finalHash: StateHash;
}
