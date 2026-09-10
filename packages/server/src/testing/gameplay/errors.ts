// Failures the scenario runner raises (docs/TESTING.md §8). Every message names the scenario,
// the seed and the tick, so a red gameplay test is reproducible from its output alone.

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

export function formatExpectationFailure(failure: ExpectationFailure): string {
  return `${INDENT}at tick ${failure.tick}: ${failure.label}\n${INDENT}${INDENT}expected ${failure.expected}, got ${failure.actual}`;
}

export function formatDivergence(divergence: HashDivergence): string {
  const agreement =
    divergence.lastAgreedTick === null ? 'no checkpoint agreed' : `identical through tick ${divergence.lastAgreedTick}`;
  return (
    `first differing checkpoint at tick ${divergence.tick}: ` +
    `expected ${divergence.expectedHash}, got ${divergence.actualHash} (${agreement})`
  );
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
  ) {
    super(`Scenario "${identity.scenarioName}" diverged (seed ${identity.seed}): ${formatDivergence(divergence)}`);
    this.name = 'ScenarioDivergenceError';
  }
}
