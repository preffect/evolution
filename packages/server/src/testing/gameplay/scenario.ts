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

import { MAX_PLAYERS_PER_GAME, type GameSessionConfig } from '@evolution/shared';
import type { ScenarioAdapter } from './adapter.js';
import { strategyScript, type BotStrategyFactory } from './bots.js';
import { ScenarioSetupError } from './errors.js';
import { CaptureBuilder, ExpectationBuilder } from './expectation-builder.js';
import type { Capture, Expectation, Selector } from './expectations.js';
import type { PlacedFixture, PlaceCellOptions, PlaceFragmentOptions, PlaceMoteOptions } from './fixtures.js';
import { FixtureScheduler, type FixtureRegistry } from './placement-builder.js';
import { createScenarioPlayer, type PlayerScriptEntry } from './players.js';
import { assertDeterministic } from './replay.js';
import {
  runScenario,
  type RunOptions,
  type ScenarioDefinition,
  type ScenarioRun,
  type ScheduledFixture,
} from './runner.js';
import { validateDefinition } from './scenario-validation.js';
import {
  EVERY_TICK,
  FIRST_STEP_TICK,
  validateScheduleWindow,
  type ScheduledScript,
  type ScheduleWindow,
} from './schedule.js';
import type { ScenarioPlayer } from './session.js';

/** Checkpoint cadence by default; `hashEvery(1)` bisects a divergence to the exact tick. */
export const DEFAULT_HASH_EVERY_TICKS = 600;
const SETUP_TICK = 0;
const MIN_PLAYERS = 1;

export class ScenarioBuilder<Input, Snapshot, Fixture> {
  private seedValue: number | null = null;
  private configValue: GameSessionConfig = { maxPlayers: MAX_PLAYERS_PER_GAME };
  private readonly playerList: ScenarioPlayer[] = [];
  private readonly fixtureList: Fixture[] = [];
  private readonly scheduledFixtureList: ScheduledFixture<Fixture>[] = [];
  private readonly scriptList: ScheduledScript<Snapshot>[] = [];
  private readonly captureList: Capture<Snapshot>[] = [];
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
    if (!Number.isInteger(count) || count < MIN_PLAYERS) {
      throw new ScenarioSetupError(`players() takes a whole number of at least ${MIN_PLAYERS}, got ${count}`);
    }
    for (let index = 0; index < count; index += 1) {
      this.playerList.push(createScenarioPlayer(this.playerList.length, SETUP_TICK));
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
    if (tick <= current.joinTick) {
      throw new ScenarioSetupError(
        `player ${playerIndex} cannot leave at tick ${tick}: it joins at tick ${current.joinTick}`,
      );
    }
    this.playerList[playerIndex] = { ...current, leaveTick: tick };
    return this;
  }

  /** A setup fixture, applied before tick 1. */
  place(fixture: Fixture): this {
    return this.fixturesAt(SETUP_TICK).place(fixture);
  }

  placeCell(this: ScenarioBuilder<Input, Snapshot, PlacedFixture>, options: PlaceCellOptions): typeof this {
    return this.fixturesAt(SETUP_TICK).placeCell(options);
  }

  placeMote(this: ScenarioBuilder<Input, Snapshot, PlacedFixture>, options: PlaceMoteOptions): typeof this {
    return this.fixturesAt(SETUP_TICK).placeMote(options);
  }

  placeFragment(this: ScenarioBuilder<Input, Snapshot, PlacedFixture>, options: PlaceFragmentOptions): typeof this {
    return this.fixturesAt(SETUP_TICK).placeFragment(options);
  }

  /** `.atTick(T).placeMote(...)`: a fixture applied before step `T`, after that tick's joins and leaves. */
  atTick(tick: number): FixtureScheduler<Fixture, this>;
  /** `.atTick(T, player(i).does(script))`: the script runs once, before step `T`. */
  atTick(tick: number, entry: PlayerScriptEntry<Snapshot>): this;
  atTick(tick: number, entry?: PlayerScriptEntry<Snapshot>): FixtureScheduler<Fixture, this> | this {
    if (entry === undefined) {
      validateScheduleWindow({ fromTick: tick, toTick: tick, everyTicks: EVERY_TICK });
      return this.fixturesAt(tick);
    }
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

  /** A strategy-driven player, deciding every `everyTicks` from the tick it is present (1, or its join). */
  bot(playerIndex: number, createStrategy: BotStrategyFactory<Snapshot>, everyTicks = EVERY_TICK): this {
    const fromTick = Math.max(FIRST_STEP_TICK, this.requirePlayer(playerIndex).joinTick);
    validateScheduleWindow({ fromTick, toTick: null, everyTicks });
    this.scriptList.push({
      fromTick,
      toTick: null,
      everyTicks,
      playerIndex,
      createScript: () => strategyScript(createStrategy()),
    });
    return this;
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

  /** `.capture('mass at removal', selector).atTick(2399)`, read back later as `view.captured(label)`. */
  capture(label: string, select: Selector<Snapshot, unknown>): CaptureBuilder<Snapshot, this> {
    return new CaptureBuilder(label, select, (capture) => {
      this.captureList.push(capture);
      return this;
    });
  }

  /** Throws `ScenarioSetupError` for anything that could never run as written (`scenario-validation.ts`). */
  build(): ScenarioDefinition<Snapshot, Fixture> {
    if (this.seedValue === null) {
      throw new ScenarioSetupError(`scenario "${this.name}" has no seed: every scenario pins one (.seed(42))`);
    }
    const definition: ScenarioDefinition<Snapshot, Fixture> = {
      name: this.name,
      seed: this.seedValue,
      config: this.configValue,
      players: [...this.playerList],
      fixtures: [...this.fixtureList],
      scheduledFixtures: [...this.scheduledFixtureList],
      scripts: [...this.scriptList],
      captures: [...this.captureList],
      expectations: [...this.expectationList],
      totalTicks: this.totalTicks,
      hashEveryTicks: this.hashEveryTicks,
    };
    validateDefinition(definition);
    return definition;
  }

  /** Runs once; throws `ScenarioAssertionError` listing every failed expectation. */
  run(): ScenarioRun<Snapshot, Fixture> {
    return runScenario(this.build(), this.adapter, this.runOptions);
  }

  /** Runs twice; throws `ScenarioDivergenceError` at the first checkpoint the runs disagree on. */
  runDeterministic(): ScenarioRun<Snapshot, Fixture> {
    return assertDeterministic(this.build(), this.adapter, this.runOptions);
  }

  private schedule(window: ScheduleWindow, entry: PlayerScriptEntry<Snapshot>): this {
    validateScheduleWindow(window);
    this.requirePlayer(entry.playerIndex);
    this.scriptList.push({ ...window, playerIndex: entry.playerIndex, createScript: () => entry.script });
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

  private fixturesAt(tick: number): FixtureScheduler<Fixture, this> {
    const registry: FixtureRegistry<Fixture, this> = {
      register: (atTick, fixture) => {
        if (atTick === SETUP_TICK) {
          this.fixtureList.push(fixture);
        } else {
          this.scheduledFixtureList.push({ tick: atTick, fixture });
        }
        return this;
      },
      requirePlayer: (playerIndex) => {
        this.requirePlayer(playerIndex);
      },
      fixtures: () => [...this.fixtureList, ...this.scheduledFixtureList.map((scheduled) => scheduled.fixture)],
    };
    return new FixtureScheduler(tick, registry);
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
