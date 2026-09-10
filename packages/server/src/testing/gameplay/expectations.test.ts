import { describe, expect, it } from 'vitest';
import { playerId } from '@evolution/shared';
import {
  AT_END,
  dueAt,
  evaluateExpectation,
  type Capture,
  type Expectation,
  type ScenarioView,
} from './expectations.js';
import { matchToBe, type Matcher } from './matchers.js';

/** What the builder does when it registers a typed matcher against the untyped expectation list. */
function untyped<Value>(matcher: Matcher<Value>): Matcher<unknown> {
  return matcher as Matcher<unknown>;
}

function viewAt(tick: number, snapshot: unknown = null, captured: Record<string, unknown> = {}): ScenarioView<unknown> {
  return {
    tick,
    seed: 42,
    snapshot,
    playerId: (index) => playerId(`player_${index}`),
    cell: () => undefined,
    captured: (label) => captured[label],
  };
}

function expectation(overrides: Partial<Expectation<unknown>>): Expectation<unknown> {
  return { tick: 0, label: 'value', select: (view) => view.snapshot, match: untyped(matchToBe(null)), ...overrides };
}

describe('evaluateExpectation', () => {
  it('returns null when the expectation holds', () => {
    expect(evaluateExpectation(expectation({ match: untyped(matchToBe(7)) }), viewAt(3, 7))).toBeNull();
  });

  it('returns the tick, label and both rendered values when it fails', () => {
    const failure = evaluateExpectation(expectation({ label: 'mass', match: untyped(matchToBe(7)) }), viewAt(3, 8));
    expect(failure).toEqual({ tick: 3, label: 'mass', expected: '7', actual: '8' });
  });

  it('reads captured values through the view and fails on one that is missing', () => {
    const doubled = expectation({ select: (view) => view.captured('mass'), match: untyped(matchToBe(9)) });
    expect(evaluateExpectation(doubled, viewAt(3, null, { mass: 9 }))).toBeNull();
    expect(evaluateExpectation(doubled, viewAt(3))).toMatchObject({ expected: '9', actual: 'undefined' });
  });
});

describe('dueAt', () => {
  it('selects expectations by tick and resolves AT_END to the final tick', () => {
    const atThree = expectation({ tick: 3 });
    const atEnd = expectation({ tick: AT_END });
    expect(dueAt([atThree, atEnd], 3, 10)).toEqual([atThree]);
    expect(dueAt([atThree, atEnd], 10, 10)).toEqual([atEnd]);
    expect(dueAt([atThree, atEnd], 3, 3)).toEqual([atThree, atEnd]);
  });

  it('works the same over captures', () => {
    const capture: Capture<unknown> = { tick: 5, label: 'mass at removal', select: (view) => view.snapshot };
    expect(dueAt([capture], 5, 10)).toEqual([capture]);
    expect(dueAt([capture], 4, 10)).toEqual([]);
  });
});
