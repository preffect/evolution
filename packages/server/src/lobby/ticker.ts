// The Ticker seam (docs/DETERMINISM.md §2): what wakes a GameRoom's fixed-step loop. The
// production ticker is the one `setInterval` allowed on the server; tests hand-crank a
// ManualTicker. Cadence never comes from the interval itself: the room counts due ticks from
// the injected Clock through the FixedStepAccumulator.

import { TICK_INTERVAL_MS } from '@evolution/shared';

/** Drives `GameRoom`'s loop: real interval in production, hand-cranked in tests. */
export interface Ticker {
  start(onTick: () => void): void;
  stop(): void;
}

/** Production ticker: wakes the room every `TICK_INTERVAL_MS` (rounded by the platform timer). */
export class IntervalTicker implements Ticker {
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly intervalMilliseconds: number = TICK_INTERVAL_MS) {}

  start(onTick: () => void): void {
    if (this.interval) return;
    this.interval = setInterval(onTick, this.intervalMilliseconds);
  }

  stop(): void {
    if (!this.interval) return;
    clearInterval(this.interval);
    this.interval = null;
  }
}

/** Test ticker: fires only when the test fires it, and only while started. */
export class ManualTicker implements Ticker {
  private onTick: (() => void) | null = null;

  start(onTick: () => void): void {
    this.onTick = onTick;
  }

  stop(): void {
    this.onTick = null;
  }

  isStarted(): boolean {
    return this.onTick !== null;
  }

  /** Fires the started callback `times` times; a stopped ticker fires nothing. */
  fire(times = 1): void {
    for (let count = 0; count < times; count += 1) this.onTick?.();
  }
}
