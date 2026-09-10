// The headless scenario runner (docs/TESTING.md §8). Given a built definition and an adapter it
// creates the module, drives it tick by tick under the manual clock, feeds joins, leaves,
// scheduled fixtures and scripted inputs before the step they apply in, records the replay,
// stores the captures and evaluates every expectation at its tick. One run reports every
// failure and where its replay went.

import type { GameSessionConfig, StateHash } from '@evolution/shared';
import type { ScenarioAdapter } from './adapter.js';
import { ScenarioAssertionError, type ExpectationFailure } from './errors.js';
import { dueAt, evaluateExpectation, type Capture, type Expectation } from './expectations.js';
import { indexByTick, type ReplayCheckpoint, type ScenarioReplay } from './replay-format.js';
import type { ReplaySink } from './replay-sink.js';
import { collectCommandsForTick, instantiateScripts, type ActiveScript, type ScheduledScript } from './schedule.js';
import { ScenarioSession, type ScenarioPlayer } from './session.js';
import { driveTicks } from './tick-driver.js';

/** A fixture applied before step `tick` (`.atTick(tick).placeMote(...)`), after that tick's joins and leaves. */
export interface ScheduledFixture<Fixture> {
  readonly tick: number;
  readonly fixture: Fixture;
}

/** Everything `scenario(...)` builds; plain data the runner and the replay consume. */
export interface ScenarioDefinition<Snapshot, Fixture> {
  readonly name: string;
  readonly seed: number;
  readonly config: GameSessionConfig;
  readonly players: readonly ScenarioPlayer[];
  /** Applied before tick 1. */
  readonly fixtures: readonly Fixture[];
  readonly scheduledFixtures: readonly ScheduledFixture<Fixture>[];
  readonly scripts: readonly ScheduledScript<Snapshot>[];
  readonly captures: readonly Capture<Snapshot>[];
  readonly expectations: readonly Expectation<Snapshot>[];
  readonly totalTicks: number;
  /** Hash checkpoint cadence; tick 0 and the final tick are always checkpoints. */
  readonly hashEveryTicks: number;
}

export interface RunOptions {
  /** Receives the replay of a failing run; without one the failure carries no path. */
  readonly replaySink?: ReplaySink;
}

export interface ScenarioRun<Snapshot, Fixture> {
  readonly replay: ScenarioReplay<Fixture>;
  readonly finalSnapshot: Snapshot;
  readonly finalHash: StateHash;
  readonly checkpoints: readonly ReplayCheckpoint[];
}

/** The shape of `runScenario` and of every check built on it (`assertDeterministic`). */
export type ScenarioRunner = <Input, Snapshot, Fixture>(
  definition: ScenarioDefinition<Snapshot, Fixture>,
  adapter: ScenarioAdapter<Input, Snapshot, Fixture>,
  options?: RunOptions,
) => ScenarioRun<Snapshot, Fixture>;

/** What one run instantiates from the definition before the first tick. */
interface PreparedRun<Snapshot, Fixture> {
  readonly scripts: readonly ActiveScript<Snapshot>[];
  readonly scheduledFixtures: Map<number, ScheduledFixture<Fixture>[]>;
}

export function isCheckpointDue(tick: number, hashEveryTicks: number, totalTicks: number): boolean {
  return tick === 0 || tick === totalTicks || tick % hashEveryTicks === 0;
}

/** Joins and leaves stamped `stepTick` happen before that step, in player index order. */
export function applyMembership<Input, Snapshot, Fixture>(
  session: ScenarioSession<Input, Snapshot, Fixture>,
  players: readonly ScenarioPlayer[],
  stepTick: number,
): void {
  for (const player of players) {
    if (player.joinTick === stepTick) {
      session.join(player);
    }
    if (player.leaveTick === stepTick) {
      session.leave(player);
    }
  }
}

/** Scripts of players not in the room at `stepTick` are neither run nor logged. */
export function applyScripts<Input, Snapshot, Fixture>(
  session: ScenarioSession<Input, Snapshot, Fixture>,
  scripts: readonly ActiveScript<Snapshot>[],
  stepTick: number,
): void {
  const present = scripts.filter((entry) => session.isPresentAt(entry.playerIndex, stepTick));
  const commands = collectCommandsForTick(present, stepTick, (playerIndex) => session.scriptContext(playerIndex));
  for (const [playerIndex, playerCommand] of commands) {
    session.submitCommand(session.playerId(playerIndex), playerCommand);
  }
}

/** Stores every capture due at the session's tick, before that tick's expectations run. */
export function captureAt<Input, Snapshot, Fixture>(
  session: ScenarioSession<Input, Snapshot, Fixture>,
  definition: ScenarioDefinition<Snapshot, Fixture>,
): void {
  const view = session.view();
  for (const capture of dueAt(definition.captures, view.tick, definition.totalTicks)) {
    session.capture(capture.label, capture.select(view));
  }
}

/** Every expectation due at the session's tick that does not hold. */
export function collectFailuresAt<Input, Snapshot, Fixture>(
  session: ScenarioSession<Input, Snapshot, Fixture>,
  definition: ScenarioDefinition<Snapshot, Fixture>,
): ExpectationFailure[] {
  const view = session.view();
  return dueAt(definition.expectations, view.tick, definition.totalTicks)
    .map((expectation) => evaluateExpectation(expectation, view))
    .filter((failure): failure is ExpectationFailure => failure !== null);
}

/** Feeds one step: joins and leaves, then the fixtures scheduled for it, then the scripts. */
function feedStep<Input, Snapshot, Fixture>(
  session: ScenarioSession<Input, Snapshot, Fixture>,
  definition: ScenarioDefinition<Snapshot, Fixture>,
  prepared: PreparedRun<Snapshot, Fixture>,
  stepTick: number,
): void {
  applyMembership(session, definition.players, stepTick);
  for (const scheduled of prepared.scheduledFixtures.get(stepTick) ?? []) {
    session.patch(scheduled.fixture);
  }
  applyScripts(session, prepared.scripts, stepTick);
}

/** Observes one tick: the checkpoint if due, then the captures, then the expectations. */
function observeTick<Input, Snapshot, Fixture>(
  session: ScenarioSession<Input, Snapshot, Fixture>,
  definition: ScenarioDefinition<Snapshot, Fixture>,
  failures: ExpectationFailure[],
): void {
  if (isCheckpointDue(session.tick, definition.hashEveryTicks, definition.totalTicks)) {
    session.recordCheckpoint();
  }
  captureAt(session, definition);
  failures.push(...collectFailuresAt(session, definition));
}

export function runScenario<Input, Snapshot, Fixture>(
  definition: ScenarioDefinition<Snapshot, Fixture>,
  adapter: ScenarioAdapter<Input, Snapshot, Fixture>,
  options: RunOptions = {},
): ScenarioRun<Snapshot, Fixture> {
  const session = new ScenarioSession(adapter, {
    scenarioName: definition.name,
    seed: definition.seed,
    config: definition.config,
    players: definition.players,
    fixtures: definition.fixtures,
  });
  const prepared: PreparedRun<Snapshot, Fixture> = {
    scripts: instantiateScripts(definition.scripts),
    scheduledFixtures: indexByTick(definition.scheduledFixtures),
  };
  const failures: ExpectationFailure[] = [];

  observeTick(session, definition, failures);
  driveTicks(definition.totalTicks, {
    beforeStep: (stepTick) => feedStep(session, definition, prepared, stepTick),
    step: () => session.step(),
    afterStep: () => observeTick(session, definition, failures),
  });

  const replay = session.toReplay();
  if (failures.length > 0) {
    const replayPath = options.replaySink?.write(replay) ?? null;
    throw new ScenarioAssertionError({ scenarioName: definition.name, seed: definition.seed }, failures, replayPath);
  }
  return {
    replay,
    finalSnapshot: session.currentSnapshot(),
    finalHash: replay.finalHash,
    checkpoints: replay.checkpoints,
  };
}
