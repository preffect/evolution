// The headless scenario runner (docs/TESTING.md §8). Given a built definition and an adapter it
// creates the module, drives it tick by tick under the manual clock, feeds joins, leaves and
// scripted inputs before the step they apply in, records the replay, and evaluates every
// expectation at its tick. One run reports every failure and where its replay went.

import type { GameSessionConfig, StateHash } from '@evolution/shared';
import type { ScenarioAdapter } from './adapter.js';
import { ScenarioAssertionError, type ExpectationFailure } from './errors.js';
import { evaluateExpectation, expectationsDueAt, type Expectation } from './expectations.js';
import type { ReplayCheckpoint, ScenarioReplay } from './replay-format.js';
import type { ReplaySink } from './replay-sink.js';
import { collectCommandsForTick, type ScheduledScript } from './schedule.js';
import { ScenarioSession, type ScenarioPlayer } from './session.js';
import { driveTicks } from './tick-driver.js';

/** Everything `scenario(...)` builds; plain data the runner and the replay consume. */
export interface ScenarioDefinition<Snapshot, Fixture> {
  readonly name: string;
  readonly seed: number;
  readonly config: GameSessionConfig;
  readonly players: readonly ScenarioPlayer[];
  readonly fixtures: readonly Fixture[];
  readonly scripts: readonly ScheduledScript<Snapshot>[];
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

export function applyScripts<Input, Snapshot, Fixture>(
  session: ScenarioSession<Input, Snapshot, Fixture>,
  scripts: readonly ScheduledScript<Snapshot>[],
  stepTick: number,
): void {
  const commands = collectCommandsForTick(scripts, stepTick, (playerIndex) => session.scriptContext(playerIndex));
  for (const [playerIndex, playerCommand] of commands) {
    session.submitCommand(session.playerId(playerIndex), playerCommand);
  }
}

/** Every expectation due at the session's tick that does not hold. */
export function collectFailuresAt<Input, Snapshot, Fixture>(
  session: ScenarioSession<Input, Snapshot, Fixture>,
  definition: ScenarioDefinition<Snapshot, Fixture>,
): ExpectationFailure[] {
  const view = session.view();
  return expectationsDueAt(definition.expectations, view.tick, definition.totalTicks)
    .map((expectation) => evaluateExpectation(expectation, view))
    .filter((failure): failure is ExpectationFailure => failure !== null);
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
  const failures: ExpectationFailure[] = [];
  const observe = (tick: number): void => {
    if (isCheckpointDue(tick, definition.hashEveryTicks, definition.totalTicks)) {
      session.recordCheckpoint();
    }
    failures.push(...collectFailuresAt(session, definition));
  };

  observe(session.tick);
  driveTicks(definition.totalTicks, {
    beforeStep: (stepTick) => {
      applyMembership(session, definition.players, stepTick);
      applyScripts(session, definition.scripts, stepTick);
    },
    step: () => session.step(),
    afterStep: observe,
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
