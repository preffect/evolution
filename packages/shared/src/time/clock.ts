// The injected clock (docs/DETERMINISM.md §2). `SystemClock` is the one place in
// packages/shared that reads wall time; everything else receives a `Clock`.

/** Monotonic milliseconds. The only way to read time. */
export interface Clock {
  nowMilliseconds(): number;
}

/** Production clock over the platform's monotonic timer (Node and browsers). */
export class SystemClock implements Clock {
  nowMilliseconds(): number {
    return performance.now();
  }
}

/** Test clock: time moves only when the test moves it. */
export class ManualClock implements Clock {
  private milliseconds: number;

  constructor(startMilliseconds = 0) {
    this.milliseconds = startMilliseconds;
  }

  nowMilliseconds(): number {
    return this.milliseconds;
  }

  advanceMilliseconds(delta: number): void {
    this.milliseconds += delta;
  }

  setMilliseconds(now: number): void {
    this.milliseconds = now;
  }
}
