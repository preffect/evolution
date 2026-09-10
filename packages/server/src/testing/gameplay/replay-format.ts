// The scenario replay record (docs/DETERMINISM.md §6, at the harness level): the seed, the
// config, the fixtures, every join and leave and every applied input stamped with the tick it
// was applied in, plus the hash checkpoints a replay compares against. Plain JSON: a failing
// scenario writes it to `qa/replays/` and `replayScenario` reads it back.

import type { GameSessionConfig, PlayerId, StateHash } from '@evolution/shared';

export const SCENARIO_REPLAY_FORMAT_VERSION = 1;

export const MEMBERSHIP_EVENT_KIND = { join: 'join', leave: 'leave' } as const;
export type MembershipEventKind = (typeof MEMBERSHIP_EVENT_KIND)[keyof typeof MEMBERSHIP_EVENT_KIND];

export interface ReplayPlayer {
  readonly playerId: PlayerId;
  readonly playerName: string;
  readonly avatarIndex: number;
}

export interface ReplayMembershipEvent extends ReplayPlayer {
  /** The tick the event applies before (a join at 6000 is present for step 6000). */
  readonly tick: number;
  readonly kind: MembershipEventKind;
}

export interface ReplayInput {
  readonly tick: number;
  readonly playerId: PlayerId;
  readonly input: unknown;
}

export interface ReplayCheckpoint {
  readonly tick: number;
  readonly hash: StateHash;
}

export interface ScenarioReplay<Fixture = unknown> {
  readonly version: number;
  readonly scenarioName: string;
  readonly seed: number;
  readonly config: GameSessionConfig;
  /** The players present at tick 0, in join order. */
  readonly roster: readonly ReplayPlayer[];
  readonly fixtures: readonly Fixture[];
  readonly membership: readonly ReplayMembershipEvent[];
  readonly inputs: readonly ReplayInput[];
  readonly checkpoints: readonly ReplayCheckpoint[];
  readonly finalTick: number;
  readonly finalHash: StateHash;
}
