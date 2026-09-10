// Replay and determinism checks (docs/DETERMINISM.md §5–6). A replay rebuilds the module from
// the recorded seed, config and fixtures, feeds the recorded joins, leaves, patches and inputs
// before the ticks they were applied in, and hashes at the recorded checkpoints; the first
// checkpoint that differs is the divergence, reported with the seed and the tick.

import type { PlayerId, StateHash } from '@evolution/shared';
import type { ScenarioAdapter } from './adapter.js';
import { ScenarioDivergenceError, type HashDivergence, type ScenarioIdentity } from './errors.js';
import {
  indexByTick,
  MEMBERSHIP_EVENT_KIND,
  type ReplayCheckpoint,
  type ReplayFixturePatch,
  type ReplayInput,
  type ReplayMembershipEvent,
  type ScenarioReplay,
} from './replay-format.js';
import { identityOf, runScenario, type ScenarioRunner } from './runner.js';
import { ScenarioSession, type ScenarioPlayer } from './session.js';
import { driveTicks } from './tick-driver.js';

export interface ReplayVerdict {
  readonly finalHash: string;
  readonly checkpoints: readonly ReplayCheckpoint[];
  /** `null` when every recorded checkpoint was reproduced. */
  readonly divergence: HashDivergence | null;
}

const MISSING_CHECKPOINT = '(no checkpoint)';

const NO_CHECKPOINT: ReplayCheckpoint = { tick: Number.NaN, hash: MISSING_CHECKPOINT as StateHash };

function isSameCheckpoint(left: ReplayCheckpoint, right: ReplayCheckpoint): boolean {
  return left.tick === right.tick && left.hash === right.hash;
}

/** The first checkpoint where `actual` differs from `expected`, or `null` when they agree throughout. */
export function findFirstDivergence(
  expected: readonly ReplayCheckpoint[],
  actual: readonly ReplayCheckpoint[],
): HashDivergence | null {
  let lastAgreedTick: number | null = null;
  const length = Math.max(expected.length, actual.length);
  for (let index = 0; index < length; index += 1) {
    const expectedCheckpoint = expected[index] ?? NO_CHECKPOINT;
    const actualCheckpoint = actual[index] ?? NO_CHECKPOINT;
    if (isSameCheckpoint(expectedCheckpoint, actualCheckpoint)) {
      lastAgreedTick = expectedCheckpoint.tick;
      continue;
    }
    return {
      tick: Number.isNaN(expectedCheckpoint.tick) ? actualCheckpoint.tick : expectedCheckpoint.tick,
      expectedHash: expectedCheckpoint.hash,
      actualHash: actualCheckpoint.hash,
      lastAgreedTick,
    };
  }
  return null;
}

/** The players a replay knows: the tick-0 roster, then every join in log order. */
export function playersOfReplay(replay: ScenarioReplay): ScenarioPlayer[] {
  const players: ScenarioPlayer[] = replay.roster.map((player, playerIndex) => ({
    ...player,
    playerIndex,
    joinTick: 0,
    leaveTick: null,
  }));
  for (const event of replay.membership) {
    if (event.kind === MEMBERSHIP_EVENT_KIND.join) {
      players.push({
        playerId: event.playerId,
        playerName: event.playerName,
        avatarIndex: event.avatarIndex,
        playerIndex: players.length,
        joinTick: event.tick,
        leaveTick: null,
      });
    }
  }
  return players;
}

/** The recording bucketed by tick once, so feeding a step costs the events of that step only. */
interface IndexedLog<Fixture> {
  readonly membership: Map<number, ReplayMembershipEvent[]>;
  readonly patches: Map<number, ReplayFixturePatch<Fixture>[]>;
  readonly inputs: Map<number, ReplayInput[]>;
}

function indexLog<Fixture>(replay: ScenarioReplay<Fixture>): IndexedLog<Fixture> {
  return {
    membership: indexByTick(replay.membership),
    patches: indexByTick(replay.patches),
    inputs: indexByTick(replay.inputs),
  };
}

/** Feeds the joins, leaves, patches and inputs the recording stamped `stepTick`, in log order. */
function applyRecordedEvents<Input, Snapshot, Fixture>(
  session: ScenarioSession<Input, Snapshot, Fixture>,
  log: IndexedLog<Fixture>,
  stepTick: number,
): void {
  for (const event of log.membership.get(stepTick) ?? []) {
    if (event.kind === MEMBERSHIP_EVENT_KIND.join) {
      session.join(event);
    } else {
      session.leave(event);
    }
  }
  for (const patch of log.patches.get(stepTick) ?? []) {
    session.patch(patch.fixture);
  }
  for (const recorded of log.inputs.get(stepTick) ?? []) {
    session.submitInput(recorded.playerId as PlayerId, recorded.input as Input);
  }
}

/** Runs the recording back through a fresh module and compares every recorded checkpoint. */
export function replayScenario<Input, Snapshot, Fixture>(
  replay: ScenarioReplay<Fixture>,
  adapter: ScenarioAdapter<Input, Snapshot, Fixture>,
): ReplayVerdict {
  const session = new ScenarioSession(adapter, {
    scenarioName: replay.scenarioName,
    // The record's own seed is the one the recording started from (docs/DETERMINISM.md §6).
    config: { ...replay.config, seed: replay.seed },
    players: playersOfReplay(replay),
    fixtures: replay.fixtures,
  });
  const log = indexLog(replay);
  const checkpointTicks = new Set(replay.checkpoints.map((checkpoint) => checkpoint.tick));
  const observe = (tick: number): void => {
    if (checkpointTicks.has(tick)) {
      session.recordCheckpoint();
    }
  };
  observe(session.tick);
  driveTicks(replay.finalTick, {
    beforeStep: (stepTick) => applyRecordedEvents(session, log, stepTick),
    step: () => session.step(),
    afterStep: observe,
  });
  const replayed = session.toReplay();
  return {
    finalHash: replayed.finalHash,
    checkpoints: replayed.checkpoints,
    divergence: findFirstDivergence(replay.checkpoints, replayed.checkpoints),
  };
}

function throwIfDiverged(identity: ScenarioIdentity, divergence: HashDivergence | null): void {
  if (divergence !== null) {
    throw new ScenarioDivergenceError(identity, divergence);
  }
}

/** `replayScenario`, throwing `ScenarioDivergenceError` when the recording is not reproduced. */
export function verifyReplay<Input, Snapshot, Fixture>(
  replay: ScenarioReplay<Fixture>,
  adapter: ScenarioAdapter<Input, Snapshot, Fixture>,
): ReplayVerdict {
  const verdict = replayScenario(replay, adapter);
  throwIfDiverged({ scenarioName: replay.scenarioName, seed: replay.seed }, verdict.divergence);
  return verdict;
}

/** Runs the scenario twice from scratch (fresh bots, fresh streams); the checkpoints must agree tick for tick. */
export const assertDeterministic: ScenarioRunner = (definition, adapter, options = {}) => {
  const firstRun = runScenario(definition, adapter, options);
  const secondRun = runScenario(definition, adapter, options);
  const divergence = findFirstDivergence(firstRun.checkpoints, secondRun.checkpoints);
  throwIfDiverged(identityOf(definition), divergence);
  return firstRun;
};
