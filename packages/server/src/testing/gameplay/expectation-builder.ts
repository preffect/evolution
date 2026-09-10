// The `.expect(label, select).atTick(tick).toBeCloseTo(value, tolerance)` chain (docs/TESTING.md §8).
// Each matcher registers one `Expectation` with the scenario and hands the builder back, so a
// row's asserts read top to bottom in the order the table states them.

import { ScenarioSetupError } from './errors.js';
import {
  AT_END,
  matchToBe,
  matchToBeCloseTo,
  matchToBeNull,
  matchToEqual,
  matchToSatisfy,
  type Expectation,
  type ExpectationTick,
  type Matcher,
  type Selector,
} from './expectations.js';

type RegisterExpectation<Snapshot, Builder> = (expectation: Expectation<Snapshot>) => Builder;

export class ExpectationBuilder<Value, Snapshot, Builder> {
  constructor(
    private readonly label: string,
    private readonly select: Selector<Snapshot, Value>,
    private readonly register: RegisterExpectation<Snapshot, Builder>,
  ) {}

  /** Evaluated on the state after step `tick`; tick 0 is the initial state. */
  atTick(tick: number): MatcherBuilder<Value, Snapshot, Builder> {
    if (!Number.isInteger(tick) || tick < 0) {
      throw new ScenarioSetupError(`an expectation tick is a non-negative whole number, got ${tick}`);
    }
    return new MatcherBuilder(tick, this.label, this.select, this.register);
  }

  /** Evaluated after the last step of the scenario. */
  atEnd(): MatcherBuilder<Value, Snapshot, Builder> {
    return new MatcherBuilder(AT_END, this.label, this.select, this.register);
  }
}

export class MatcherBuilder<Value, Snapshot, Builder> {
  constructor(
    private readonly tick: ExpectationTick,
    private readonly label: string,
    private readonly select: Selector<Snapshot, Value>,
    private readonly register: RegisterExpectation<Snapshot, Builder>,
  ) {}

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
  toBeCloseTo(
    this: MatcherBuilder<number | null | undefined, Snapshot, Builder>,
    expected: number,
    tolerance?: number,
  ): Builder {
    return this.add(matchToBeCloseTo(expected, tolerance));
  }

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
