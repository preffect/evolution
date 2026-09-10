// The scenario DSL (docs/TESTING.md §8): typed builders, no string parsing. A table row reads
//
//   scenario('E9: A absorbs B').seed(42).players(2)
//     .placeCell({ playerIndex: 0, mass: 100 }).placeCell({ playerIndex: 1, mass: 20, eastOfFirstCellWu: 10 })
//     .advance(30)
//     .expect('A mass', (view) => massOf(view, 0)).atTick(30).toBeCloseTo(decayed(100, 30) + 16, 0.01)
//     .run();
//
// `createScenarioDsl(adapter)` binds the builder to a module; `echo-adapter.ts` exports the
// binding for the template's echo game, #98 adds the Evolution one.

import { AVATAR_INDEX_MAX, MAX_PLAYERS_PER_GAME, playerId, type GameSessionConfig } from '@evolution/shared';
import type { ScenarioAdapter } from './adapter.js';
import { strategyScript, type BotStrategy } from './bots.js';
import { ScenarioSetupError } from './errors.js';
import { ExpectationBuilder } from './expectation-builder.js';
import type { Expectation, Selector } from './expectations.js';
import {
  placeCell,
  placeFragment,
  placeMote,
  PLACED_KIND,
  type PlacedCell,
  type PlacedFixture,
  type PlaceCellOptions,
  type PlaceFragmentOptions,
  type PlaceMoteOptions,
} from './fixtures.js';
import { assertDeterministic } from './replay.js';
import { runScenario, type RunOptions, type ScenarioDefinition, type ScenarioRun } from './runner.js';
import { EVERY_TICK, FIRST_STEP_TICK, validateScheduleWindow, type ScheduledScript } from './schedule.js';
import type { PlayerScript } from './scripts.js';
import type { ScenarioPlayer } from './session.js';

/** Checkpoint cadence by default; `hashEvery(1)` bisects a divergence to the exact tick. */
export const DEFAULT_HASH_EVERY_TICKS = 600;
const PLAYER_ID_PREFIX = 'player_';
const AVATAR_COUNT = AVATAR_INDEX_MAX + 1;

export interface PlayerScriptEntry<Snapshot> {
  readonly playerIndex: number;
  readonly script: PlayerScript<Snapshot>;
}

export interface PlayerHandle {
  does<Snapshot>(script: PlayerScript<Snapshot>): PlayerScriptEntry<Snapshot>;
}

/** `player(1).does(targetRadiiEast(5))` names who a script drives. */
export function player(playerIndex: number): PlayerHandle {
  return { does: (script) => ({ playerIndex, script }) };
}

export function scenarioPlayerId(playerIndex: number) {
  return playerId(`${PLAYER_ID_PREFIX}${playerIndex}`);
}

function createScenarioPlayer(playerIndex: number, joinTick: number): ScenarioPlayer {
  return {
    playerIndex,
    playerId: scenarioPlayerId(playerIndex),
    playerName: `Player ${playerIndex}`,
    avatarIndex: playerIndex % AVATAR_COUNT,
    joinTick,
    leaveTick: null,
  };
}

export class ScenarioBuilder<Input, Snapshot, Fixture> {
  private seedValue: number | null = null;
  private configValue: GameSessionConfig = { maxPlayers: MAX_PLAYERS_PER_GAME };
  private readonly playerList: ScenarioPlayer[] = [];
  private readonly fixtureList: Fixture[] = [];
  private readonly scriptList: ScheduledScript<Snapshot>[] = [];
  private readonly expectationList: Expectation<Snapshot>[] = [];
  private totalTicks = 0;
  private hashEveryTicks = DEFAULT_HASH_EVERY_TICKS;

  constructor(
    readonly name: string,
    private readonly adapter: ScenarioAdapter<Input, Snapshot, Fixture>,
    private readonly runOptions: RunOptions,
  ) {}

  seed(seed: number): this {
    this.seedValue = seed;
    return this;
  }

  config(overrides: Partial<GameSessionConfig>): this {
    this.configValue = { ...this.configValue, ...overrides };
    return this;
  }

  /** `count` players present from tick 0, indices 0 … count − 1. */
  players(count: number): this {
    for (let index = 0; index < count; index += 1) {
      this.playerList.push(createScenarioPlayer(this.playerList.length, 0));
    }
    return this;
  }

  /** A late joiner, present for step `tick`; its index is the player count before the call. */
  playerJoinsAt(tick: number): this {
    validateScheduleWindow({ fromTick: tick, toTick: null, everyTicks: EVERY_TICK });
    this.playerList.push(createScenarioPlayer(this.playerList.length, tick));
    return this;
  }

  /** The player is removed before step `tick` (the room's grace timer, driven by the fixture). */
  playerLeavesAt(tick: number, playerIndex: number): this {
    validateScheduleWindow({ fromTick: tick, toTick: null, everyTicks: EVERY_TICK });
    const current = this.requirePlayer(playerIndex);
    this.playerList[playerIndex] = { ...current, leaveTick: tick };
    return this;
  }

  place(fixture: Fixture): this {
    this.fixtureList.push(fixture);
    return this;
  }

  placeCell(this: ScenarioBuilder<Input, Snapshot, PlacedFixture>, options: PlaceCellOptions): typeof this {
    this.requirePlayer(options.playerIndex);
    return this.place(placeCell(options, this.firstPlacedCell()));
  }

  placeMote(this: ScenarioBuilder<Input, Snapshot, PlacedFixture>, options: PlaceMoteOptions): typeof this {
    return this.place(placeMote(options, this.firstPlacedCell()));
  }

  placeFragment(this: ScenarioBuilder<Input, Snapshot, PlacedFixture>, options: PlaceFragmentOptions): typeof this {
    return this.place(placeFragment(options, this.firstPlacedCell()));
  }

  /** The script runs once, before step `tick`. */
  atTick(tick: number, entry: PlayerScriptEntry<Snapshot>): this {
    return this.schedule({ fromTick: tick, toTick: tick, everyTicks: EVERY_TICK }, entry);
  }

  /** The script runs before every step from `fromTick` (default 1) to the end. */
  from(fromTick: number, entry: PlayerScriptEntry<Snapshot>): this {
    return this.schedule({ fromTick, toTick: null, everyTicks: EVERY_TICK }, entry);
  }

  /** The script runs before every step in the inclusive window. */
  between(fromTick: number, toTick: number, entry: PlayerScriptEntry<Snapshot>): this {
    return this.schedule({ fromTick, toTick, everyTicks: EVERY_TICK }, entry);
  }

  /** The script runs before step `fromTick` and every `everyTicks` after it ("re-evaluated every 30 ticks"). */
  every(everyTicks: number, entry: PlayerScriptEntry<Snapshot>, fromTick = FIRST_STEP_TICK): this {
    return this.schedule({ fromTick, toTick: null, everyTicks }, entry);
  }

  /** A strategy-driven player, deciding every `everyTicks` from tick 1. */
  bot(playerIndex: number, strategy: BotStrategy<Snapshot>, everyTicks = EVERY_TICK): this {
    return this.every(everyTicks, { playerIndex, script: strategyScript(strategy) });
  }

  advance(ticks: number): this {
    if (!Number.isInteger(ticks) || ticks < 0) {
      throw new ScenarioSetupError(`advance() takes a non-negative whole number of ticks, got ${ticks}`);
    }
    this.totalTicks += ticks;
    return this;
  }

  hashEvery(ticks: number): this {
    if (!Number.isInteger(ticks) || ticks < EVERY_TICK) {
      throw new ScenarioSetupError(`hashEvery() takes a positive whole number of ticks, got ${ticks}`);
    }
    this.hashEveryTicks = ticks;
    return this;
  }

  expect<Value>(label: string, select: Selector<Snapshot, Value>): ExpectationBuilder<Value, Snapshot, this> {
    return new ExpectationBuilder(label, select, (expectation) => {
      this.expectationList.push(expectation);
      return this;
    });
  }

  build(): ScenarioDefinition<Snapshot, Fixture> {
    if (this.seedValue === null) {
      throw new ScenarioSetupError(`scenario "${this.name}" has no seed: every scenario pins one (.seed(42))`);
    }
    return {
      name: this.name,
      seed: this.seedValue,
      config: this.configValue,
      players: [...this.playerList],
      fixtures: [...this.fixtureList],
      scripts: [...this.scriptList],
      expectations: [...this.expectationList],
      totalTicks: this.totalTicks,
      hashEveryTicks: this.hashEveryTicks,
    };
  }

  /** Runs once; throws `ScenarioAssertionError` listing every failed expectation. */
  run(): ScenarioRun<Snapshot, Fixture> {
    return runScenario(this.build(), this.adapter, this.runOptions);
  }

  /** Runs twice; throws `ScenarioDivergenceError` at the first checkpoint the runs disagree on. */
  runDeterministic(): ScenarioRun<Snapshot, Fixture> {
    return assertDeterministic(this.build(), this.adapter, this.runOptions);
  }

  private schedule(
    window: Pick<ScheduledScript<Snapshot>, 'fromTick' | 'toTick' | 'everyTicks'>,
    entry: PlayerScriptEntry<Snapshot>,
  ): this {
    validateScheduleWindow(window);
    this.requirePlayer(entry.playerIndex);
    this.scriptList.push({ ...window, playerIndex: entry.playerIndex, script: entry.script });
    return this;
  }

  private requirePlayer(playerIndex: number): ScenarioPlayer {
    const found = this.playerList[playerIndex];
    if (found === undefined) {
      throw new ScenarioSetupError(
        `player ${playerIndex} does not exist in "${this.name}" (${this.playerList.length} players declared)`,
      );
    }
    return found;
  }

  private firstPlacedCell(this: ScenarioBuilder<Input, Snapshot, PlacedFixture>): PlacedCell | undefined {
    return this.fixtureList.find((fixture): fixture is PlacedCell => fixture.kind === PLACED_KIND.cell);
  }
}

export type ScenarioDsl<Input, Snapshot, Fixture> = (name: string) => ScenarioBuilder<Input, Snapshot, Fixture>;

/** Binds the DSL to an adapter: `const scenario = createScenarioDsl(evolutionAdapter)`. */
export function createScenarioDsl<Input, Snapshot, Fixture>(
  adapter: ScenarioAdapter<Input, Snapshot, Fixture>,
  runOptions: RunOptions = {},
): ScenarioDsl<Input, Snapshot, Fixture> {
  return (name) => new ScenarioBuilder(name, adapter, runOptions);
}
