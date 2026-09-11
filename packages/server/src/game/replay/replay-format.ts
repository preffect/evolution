// The module's replay record (docs/DETERMINISM.md §6): everything a round's simulation saw,
// stamped with the tick it was applied at. Beyond the doc's shape it carries `startTick` (the
// tick counter continues across a rematch) and `roster` (who was present when the recording
// started), both needed to rebuild the world the recording started from.

import type { BalanceConfig, GameInput, GameSessionConfig, PlayerId, StateHash } from '@evolution/shared';
import type { BalancePatch, DnaGrant, PlayerPatch, SpawnRequest } from '../debug/simulation-debug-handle.js';
import type { PlayerIdentity } from '../session/players.js';

/** The debug mutations a recording carries (docs/ARCHITECTURE.md §8): the recording owns this vocabulary, `debug/` applies it. */
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
 * inspection and never rebuilt by `replay()` (docs/DETERMINISM.md §6).
 */
export const REPLAY_ORIGIN = { worldBuild: 'world_build', rematch: 'rematch', reseed: 'reseed' } as const;
export type ReplayOrigin = (typeof REPLAY_ORIGIN)[keyof typeof REPLAY_ORIGIN];

export const REPLAY_MEMBERSHIP_KIND = { join: 'join', leave: 'leave' } as const;
export type ReplayMembershipKind = (typeof REPLAY_MEMBERSHIP_KIND)[keyof typeof REPLAY_MEMBERSHIP_KIND];

export interface ReplayMembershipEvent extends PlayerIdentity {
  /** The tick the event applies before (a join stamped 6000 is present for step 6000). */
  readonly tick: number;
  readonly kind: ReplayMembershipKind;
}

export interface ReplayInput {
  readonly tick: number;
  readonly playerId: PlayerId;
  /** The coalesced input step 1 applied at `tick`. */
  readonly input: GameInput;
}

export interface ReplayDebugPatch {
  readonly tick: number;
  readonly patch: DebugPatch;
}

export interface Replay {
  readonly version: number;
  readonly startedBy: ReplayOrigin;
  /** The round seed the recording started from. */
  readonly seed: number;
  readonly startTick: number;
  /** The entity counter at the start: a rematch continues it, so the rebuilt ids match (docs/DETERMINISM.md §6). */
  readonly nextEntityNumber: number;
  readonly config: GameSessionConfig;
  /** The numbers the run used, so a live-tuned room still replays. */
  readonly balance: BalanceConfig;
  /** The players present when the recording started, in join order. */
  readonly roster: readonly PlayerIdentity[];
  readonly membership: readonly ReplayMembershipEvent[];
  readonly inputs: readonly ReplayInput[];
  readonly debugPatches: readonly ReplayDebugPatch[];
  readonly finalTick: number;
  readonly finalHash: StateHash;
}
