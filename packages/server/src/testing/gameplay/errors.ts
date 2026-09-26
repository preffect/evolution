// Failures the scenario runner raises (docs/testing/scenario-runner.md §8). Every message names the scenario,
// the seed and the tick, so a red gameplay test is reproducible from its output alone.

import { renderValue, type StructuralDifference } from '../structural-diff.js';

const INDENT = '  ';

/** A mistake in the scenario itself (an input at tick 0, a fixture the adapter cannot place). */
export class ScenarioSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScenarioSetupError';
  }
}

export interface ScenarioIdentity {
  readonly scenarioName: string;
  readonly seed: number;
}

/** One expectation that did not hold, with the values rendered for the failure output. */
export interface ExpectationFailure {
  readonly tick: number;
  readonly label: string;
  readonly expected: string;
  readonly actual: string;
}

/** The first checkpoint at which two runs (or a run and its replay) hashed differently. */
export interface HashDivergence {
  readonly tick: number;
  readonly expectedHash: string;
  readonly actualHash: string;
  /** The last checkpoint tick both sides agreed on; `null` when they differed from tick 0. */
  readonly lastAgreedTick: number | null;
}

/**
 * Both sides re-run to the divergent tick (`assertDeterministic`), so the report can name a field.
 * A replay's recorded side keeps hashes only, so `verifyReplay` attaches none.
 */
export interface DivergenceSnapshots {
  readonly expectedSnapshot: unknown;
  readonly actualSnapshot: unknown;
  /** Whether the re-runs also hashed differently at the tick; `false` means the divergence did not recur. */
  readonly wasReproduced: boolean;
  /** `null` when the snapshots agree: the difference lies in hashed state the snapshot does not show. */
  readonly firstDifference: StructuralDifference | null;
}

export function formatExpectationFailure(failure: ExpectationFailure): string {
  return `${INDENT}at tick ${failure.tick}: ${failure.label}\n${INDENT}${INDENT}expected ${failure.expected}, got ${failure.actual}`;
}

function formatSnapshotDifference(tick: number, snapshots: DivergenceSnapshots): string {
  if (!snapshots.wasReproduced) {
    return `${INDENT}re-running both sides to tick ${tick} did not reproduce the divergence`;
  }
  const difference = snapshots.firstDifference;
  if (difference === null) {
    return `${INDENT}the snapshots at tick ${tick} agree: the hashed state differs outside the snapshot`;
  }
  return (
    `${INDENT}first differing path at tick ${tick}: ${difference.path}\n` +
    `${INDENT}${INDENT}expected ${renderValue(difference.expected)}, got ${renderValue(difference.actual)}`
  );
}

export function formatDivergence(divergence: HashDivergence, snapshots: DivergenceSnapshots | null = null): string {
  const agreement =
    divergence.lastAgreedTick === null ? 'no checkpoint agreed' : `identical through tick ${divergence.lastAgreedTick}`;
  const headline =
    `first differing checkpoint at tick ${divergence.tick}: ` +
    `expected ${divergence.expectedHash}, got ${divergence.actualHash} (${agreement})`;
  return snapshots === null ? headline : `${headline}\n${formatSnapshotDifference(divergence.tick, snapshots)}`;
}

/** One or more `expect(...)` clauses failed; the replay (when a sink was given) is at `replayPath`. */
export class ScenarioAssertionError extends Error {
  constructor(
    identity: ScenarioIdentity,
    readonly failures: readonly ExpectationFailure[],
    readonly replayPath: string | null,
  ) {
    const lines = [
      `Scenario "${identity.scenarioName}" failed (seed ${identity.seed}):`,
      ...failures.map(formatExpectationFailure),
    ];
    if (replayPath !== null) {
      lines.push(`${INDENT}replay written to ${replayPath}`);
    }
    super(lines.join('\n'));
    this.name = 'ScenarioAssertionError';
  }
}

/** Two runs of the same seed and inputs hashed differently: a determinism bug, never a flake. */
export class ScenarioDivergenceError extends Error {
  constructor(
    identity: ScenarioIdentity,
    readonly divergence: HashDivergence,
    /** Both sides at `divergence.tick` and their first differing path; `null` after `verifyReplay`. */
    readonly snapshots: DivergenceSnapshots | null = null,
  ) {
    super(
      `Scenario "${identity.scenarioName}" diverged (seed ${identity.seed}): ${formatDivergence(divergence, snapshots)}`,
    );
    this.name = 'ScenarioDivergenceError';
  }
}
