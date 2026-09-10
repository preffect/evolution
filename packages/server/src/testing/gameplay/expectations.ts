// Assertions with tolerances (docs/TESTING.md §8). An expectation selects a value from the view
// at a tick and matches it (`matchers.ts`); a failed match is reported with the tick, the label
// and both values rather than thrown on the spot, so one run reports every failure and its
// replay at once. A capture stores a selected value under a label for a later expectation.

import type { PlayerId } from '@evolution/shared';
import type { CellLocation } from './adapter.js';
import type { ExpectationFailure } from './errors.js';
import type { Matcher } from './matchers.js';

/** What a selector sees: the tick's snapshot plus the roster, cell lookups and earlier captures. */
export interface ScenarioView<Snapshot> {
  readonly tick: number;
  readonly seed: number;
  readonly snapshot: Snapshot;
  playerId(playerIndex: number): PlayerId;
  cell(playerIndex: number): CellLocation | undefined;
  /** A value captured at an earlier tick; `undefined` (which every matcher fails) when not captured yet. */
  captured(label: string): unknown;
}

export type Selector<Snapshot, Value> = (view: ScenarioView<Snapshot>) => Value;

/** The pseudo-tick meaning "after the last step of the scenario". */
export const AT_END = 'end';
export type ExpectationTick = number | typeof AT_END;

export interface Expectation<Snapshot> {
  readonly tick: ExpectationTick;
  readonly label: string;
  readonly select: Selector<Snapshot, unknown>;
  readonly match: Matcher<unknown>;
}

/** `.capture(label, select).atTick(T)`: what `view.captured(label)` returns from tick T on. */
export interface Capture<Snapshot> {
  readonly tick: ExpectationTick;
  readonly label: string;
  readonly select: Selector<Snapshot, unknown>;
}

/** Evaluates one expectation against a view; `null` when it holds. */
export function evaluateExpectation<Snapshot>(
  expectation: Expectation<Snapshot>,
  view: ScenarioView<Snapshot>,
): ExpectationFailure | null {
  const outcome = expectation.match(expectation.select(view));
  if (outcome.isMatch) {
    return null;
  }
  return { tick: view.tick, label: expectation.label, expected: outcome.expected, actual: outcome.actual };
}

export function resolveExpectationTick(tick: ExpectationTick, finalTick: number): number {
  return tick === AT_END ? finalTick : tick;
}

/** The expectations or captures due at `tick`, resolving `AT_END` against `finalTick`. */
export function dueAt<Item extends { readonly tick: ExpectationTick }>(
  items: readonly Item[],
  tick: number,
  finalTick: number,
): Item[] {
  return items.filter((item) => resolveExpectationTick(item.tick, finalTick) === tick);
}
