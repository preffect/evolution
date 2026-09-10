// The module's replay record (docs/DETERMINISM.md §6): everything a round's simulation saw,
// stamped with the tick it was applied at. Beyond the doc's shape it carries `startTick` (the
// tick counter continues across a rematch) and `roster` (who was present when the recording
// started), both needed to rebuild the world the recording started from.

import type { BalanceConfig, GameInput, GameSessionConfig, PlayerId, StateHash } from '@evolution/shared';
import type { DebugPatch } from '../debug/debug-operations.js';
import type { PlayerIdentity } from '../session/players.js';

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
  /** The round seed the recording started from. */
  readonly seed: number;
  readonly startTick: number;
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
