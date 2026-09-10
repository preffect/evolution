// The `.expect(label, select).atTick(tick).toBeCloseTo(value, tolerance)` chain and its
// `.capture(label, select).atTick(tick)` sibling (docs/TESTING.md §8). Each matcher registers
// one `Expectation` with the scenario and hands the builder back, so a row's asserts read top
// to bottom in the order the table states them.

import { ScenarioSetupError } from './errors.js';
import { AT_END, type Capture, type Expectation, type ExpectationTick, type Selector } from './expectations.js';
import {
  matchToBe,
  matchToBeAtLeast,
  matchToBeAtMost,
  matchToBeBetween,
  matchToBeCloseTo,
  matchToBeGreaterThan,
  matchToBeLessThan,
  matchToBeNull,
  matchToEqual,
  matchToSatisfy,
  type Matcher,
} from './matchers.js';

type RegisterExpectation<Snapshot, Builder> = (expectation: Expectation<Snapshot>) => Builder;

/** A number that may be missing: the numeric matchers accept it and fail on `undefined`. */
type MaybeNumber = number | null | undefined;

/** Ticks are absolute across accumulated `.advance()` calls; tick 0 is the initial state. */
export function validateObservationTick(tick: number): void {
  if (!Number.isInteger(tick) || tick < 0) {
    throw new ScenarioSetupError(`an expectation tick is a non-negative whole number, got ${tick}`);
  }
}

/** What every builder in the chain carries: the label, the selector and where the result is registered. */
abstract class ObservationBuilder<Value, Snapshot, Registered, Builder> {
  constructor(
    protected readonly label: string,
    protected readonly select: Selector<Snapshot, Value>,
    protected readonly register: (registered: Registered) => Builder,
  ) {}
}

export class ExpectationBuilder<Value, Snapshot, Builder> extends ObservationBuilder<
  Value,
  Snapshot,
  Expectation<Snapshot>,
  Builder
> {
  /** Evaluated on the state after step `tick`; tick 0 is the initial state. */
  atTick(tick: number): MatcherBuilder<Value, Snapshot, Builder> {
    validateObservationTick(tick);
    return new MatcherBuilder(tick, this.label, this.select, this.register);
  }

  /** Evaluated after the last step of the scenario. */
  atEnd(): MatcherBuilder<Value, Snapshot, Builder> {
    return new MatcherBuilder(AT_END, this.label, this.select, this.register);
  }
}

export class CaptureBuilder<Snapshot, Builder> extends ObservationBuilder<
  unknown,
  Snapshot,
  Capture<Snapshot>,
  Builder
> {
  /** Stored from the state after step `tick`, before that tick's expectations run. */
  atTick(tick: number): Builder {
    validateObservationTick(tick);
    return this.register({ tick, label: this.label, select: this.select });
  }

  atEnd(): Builder {
    return this.register({ tick: AT_END, label: this.label, select: this.select });
  }
}

export class MatcherBuilder<Value, Snapshot, Builder> extends ObservationBuilder<
  Value,
  Snapshot,
  Expectation<Snapshot>,
  Builder
> {
  constructor(
    private readonly tick: ExpectationTick,
    label: string,
    select: Selector<Snapshot, Value>,
    register: RegisterExpectation<Snapshot, Builder>,
  ) {
    super(label, select, register);
  }

  toBe(expected: Value): Builder {
    return this.add(matchToBe(expected));
  }

  toEqual(expected: Value): Builder {
    return this.add(matchToEqual(expected));
  }

  toBeNull(this: MatcherBuilder<unknown, Snapshot, Builder>): Builder {
    return this.add(matchToBeNull());
  }

  /** `|actual − expected| ≤ tolerance` ("± 0.01" in the tables); a missing value fails, not compiles out. */
  toBeCloseTo(this: MatcherBuilder<MaybeNumber, Snapshot, Builder>, expected: number, tolerance?: number): Builder {
    return this.add(matchToBeCloseTo(expected, tolerance));
  }

  toBeLessThan(this: MatcherBuilder<MaybeNumber, Snapshot, Builder>, bound: number): Builder {
    return this.add(matchToBeLessThan(bound));
  }

  toBeGreaterThan(this: MatcherBuilder<MaybeNumber, Snapshot, Builder>, bound: number): Builder {
    return this.add(matchToBeGreaterThan(bound));
  }

  /** `actual ≥ bound` ("≥ 5" in the tables). */
  toBeAtLeast(this: MatcherBuilder<MaybeNumber, Snapshot, Builder>, bound: number): Builder {
    return this.add(matchToBeAtLeast(bound));
  }

  toBeAtMost(this: MatcherBuilder<MaybeNumber, Snapshot, Builder>, bound: number): Builder {
    return this.add(matchToBeAtMost(bound));
  }

  /** Inclusive on both ends ("between 70 and 74"). */
  toBeBetween(this: MatcherBuilder<MaybeNumber, Snapshot, Builder>, low: number, high: number): Builder {
    return this.add(matchToBeBetween(low, high));
  }

  /** The escape hatch: `description` is exactly what a failure prints, so state the bound and unit in it. */
  toSatisfy(predicate: (actual: Value) => boolean, description: string): Builder {
    return this.add(matchToSatisfy(predicate, description));
  }

  private add(match: Matcher<Value>): Builder {
    return this.register({
      tick: this.tick,
      label: this.label,
      select: this.select,
      match: match as Matcher<unknown>,
    });
  }
}
