// One live module under the runner (docs/TESTING.md §8): the roster, the per-player input
// sequences and random streams, the cached snapshot of the current tick, the captured values,
// and the replay log of everything the module was fed. Both the scenario run and its replay
// drive a session; only what feeds it differs.

import {
  createSeededRandom,
  type GameSessionConfig,
  type PlayerId,
  type RandomSource,
  type StateHash,
} from '@evolution/shared';
import type { GameModule } from '../../game/game-module.js';
import type { FixtureContext, PlayerCommand, ScenarioAdapter } from './adapter.js';
import { ScenarioSetupError } from './errors.js';
import type { ScenarioView } from './expectations.js';
import {
  MEMBERSHIP_EVENT_KIND,
  SCENARIO_REPLAY_FORMAT_VERSION,
  type ReplayCheckpoint,
  type ReplayFixturePatch,
  type ReplayInput,
  type ReplayMembershipEvent,
  type ReplayPlayer,
  type ScenarioReplay,
} from './replay-format.js';
import type { ScriptContext } from './scripts.js';

/** A scenario player: a fixed index and id, present from `joinTick` until `leaveTick`. */
export interface ScenarioPlayer extends ReplayPlayer {
  readonly playerIndex: number;
  readonly joinTick: number;
  readonly leaveTick: number | null;
}

/** Present for step `stepTick`: joined before it (a join at T is present for step T) and not removed before it. */
export function isPlayerPresentAt(player: ScenarioPlayer, stepTick: number): boolean {
  return player.joinTick <= stepTick && (player.leaveTick === null || stepTick < player.leaveTick);
}

export interface SessionSetup<Fixture> {
  readonly scenarioName: string;
  readonly seed: number;
  readonly config: GameSessionConfig;
  readonly players: readonly ScenarioPlayer[];
  readonly fixtures: readonly Fixture[];
}

const FIRST_SEQUENCE = 1;
const INITIAL_TICK = 0;
/** Each scripted player forks its own stream from the scenario seed, by this label plus its index. */
const PLAYER_STREAM_LABEL_PREFIX = 'scenario_player_';

/** Only the fields a replay stores; a `ScenarioPlayer` carries scheduling fields the log must not. */
function toReplayPlayer({ playerId, playerName, avatarIndex }: ReplayPlayer): ReplayPlayer {
  return { playerId, playerName, avatarIndex };
}

export class ScenarioSession<Input, Snapshot, Fixture> {
  readonly module: GameModule;
  tick = INITIAL_TICK;
  private snapshot: Snapshot;
  private readonly randomRoot: RandomSource;
  private readonly playerRandoms = new Map<number, RandomSource>();
  private readonly sequences = new Map<PlayerId, number>();
  private readonly captures = new Map<string, unknown>();
  private readonly membership: ReplayMembershipEvent[] = [];
  private readonly patches: ReplayFixturePatch<Fixture>[] = [];
  private readonly inputs: ReplayInput[] = [];
  private readonly checkpoints: ReplayCheckpoint[] = [];

  constructor(
    private readonly adapter: ScenarioAdapter<Input, Snapshot, Fixture>,
    private readonly setup: SessionSetup<Fixture>,
  ) {
    const roster = setup.players.filter((player) => player.joinTick === INITIAL_TICK);
    const [creator] = roster;
    if (creator === undefined) {
      throw new ScenarioSetupError(`scenario "${setup.scenarioName}" has no player present at tick 0`);
    }
    this.randomRoot = createSeededRandom(setup.seed);
    this.module = adapter.createModule({
      creatorId: creator.playerId,
      playerIds: roster.map((player) => player.playerId),
      gameName: setup.scenarioName,
      config: setup.config,
      avatarAssignments: Object.fromEntries(roster.map((player) => [player.playerId, player.avatarIndex])),
      playerNames: Object.fromEntries(roster.map((player) => [player.playerId, player.playerName])),
      seed: setup.seed,
    });
    for (const fixture of setup.fixtures) {
      adapter.applyFixture(this.module, fixture, this.fixtureContext(INITIAL_TICK));
    }
    this.snapshot = adapter.readSnapshot(this.module);
  }

  get seed(): number {
    return this.setup.seed;
  }

  player(playerIndex: number): ScenarioPlayer {
    const player = this.setup.players[playerIndex];
    if (player === undefined) {
      throw new ScenarioSetupError(`player ${playerIndex} is not in scenario "${this.setup.scenarioName}"`);
    }
    return player;
  }

  playerId(playerIndex: number): PlayerId {
    return this.player(playerIndex).playerId;
  }

  isPresentAt(playerIndex: number, stepTick: number): boolean {
    return isPlayerPresentAt(this.player(playerIndex), stepTick);
  }

  currentSnapshot(): Snapshot {
    return this.snapshot;
  }

  view(): ScenarioView<Snapshot> {
    return {
      tick: this.tick,
      seed: this.setup.seed,
      snapshot: this.snapshot,
      playerId: (playerIndex) => this.playerId(playerIndex),
      cell: (playerIndex) => this.adapter.locateCell(this.snapshot, this.playerId(playerIndex)),
      captured: (label) => this.captures.get(label),
    };
  }

  /** The cell is looked up only when the script reads it, so an adapter without a world fails the scripts that need one. */
  scriptContext(playerIndex: number): ScriptContext<Snapshot> {
    const { adapter, snapshot } = this;
    const playerId = this.playerId(playerIndex);
    return {
      tick: this.tick,
      stepTick: this.tick + 1,
      playerIndex,
      playerId,
      snapshot,
      get cell() {
        return adapter.locateCell(snapshot, playerId);
      },
      seed: this.setup.seed,
      random: this.randomFor(playerIndex),
    };
  }

  capture(label: string, value: unknown): void {
    this.captures.set(label, value);
  }

  /** Adds a late joiner before the next step and logs it at that step's tick. */
  join(player: ReplayPlayer): void {
    this.module.addPlayer(player.playerId, player.avatarIndex, player.playerName);
    this.membership.push({ ...toReplayPlayer(player), tick: this.tick + 1, kind: MEMBERSHIP_EVENT_KIND.join });
  }

  leave(player: ReplayPlayer): void {
    this.module.removePlayer(player.playerId);
    this.membership.push({ ...toReplayPlayer(player), tick: this.tick + 1, kind: MEMBERSHIP_EVENT_KIND.leave });
  }

  /** Applies a scheduled fixture before the next step and logs it as a patch at that step's tick. */
  patch(fixture: Fixture): void {
    const tick = this.tick + 1;
    this.adapter.applyFixture(this.module, fixture, this.fixtureContext(tick));
    this.patches.push({ tick, fixture });
  }

  /** Stamps the next sequence for the player, converts through the adapter and submits. */
  submitCommand(playerId: PlayerId, playerCommand: PlayerCommand): Input {
    const previous = this.sequences.get(playerId);
    const sequence = previous === undefined ? FIRST_SEQUENCE : previous + 1;
    this.sequences.set(playerId, sequence);
    const input = this.adapter.toInput(playerCommand, sequence);
    this.submitInput(playerId, input);
    return input;
  }

  /** Submits an already-built input (the replay path) and logs it at the next step's tick. */
  submitInput(playerId: PlayerId, input: Input): void {
    this.module.submitInput(playerId, input);
    this.inputs.push({ tick: this.tick + 1, playerId, input });
  }

  step(): void {
    this.module.reduceGameState();
    this.tick += 1;
    this.snapshot = this.adapter.readSnapshot(this.module);
  }

  hash(): StateHash {
    return this.adapter.hashState(this.module);
  }

  recordCheckpoint(): ReplayCheckpoint {
    const checkpoint = { tick: this.tick, hash: this.hash() };
    this.checkpoints.push(checkpoint);
    return checkpoint;
  }

  toReplay(): ScenarioReplay<Fixture> {
    return {
      version: SCENARIO_REPLAY_FORMAT_VERSION,
      scenarioName: this.setup.scenarioName,
      seed: this.setup.seed,
      config: this.setup.config,
      roster: this.setup.players.filter((player) => player.joinTick === INITIAL_TICK).map(toReplayPlayer),
      fixtures: [...this.setup.fixtures],
      membership: [...this.membership],
      patches: [...this.patches],
      inputs: [...this.inputs],
      checkpoints: [...this.checkpoints],
      finalTick: this.tick,
      finalHash: this.hash(),
    };
  }

  private fixtureContext(tick: number): FixtureContext {
    return { tick, playerId: (playerIndex) => this.playerId(playerIndex) };
  }

  private randomFor(playerIndex: number): RandomSource {
    let random = this.playerRandoms.get(playerIndex);
    if (random === undefined) {
      random = this.randomRoot.fork(`${PLAYER_STREAM_LABEL_PREFIX}${playerIndex}`);
      this.playerRandoms.set(playerIndex, random);
    }
    return random;
  }
}
