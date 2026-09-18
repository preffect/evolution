// The injected scheduler (docs/determinism/contract-and-clock.md §1, §2), beside the injected `Clock`.
//
// **Why this exists at all.** `setTimeout` is lint-banned in every `packages/*/src` file, and `packages/shared/src/time/`
// is one of the two places allowed to name it. The simulation never needs a delay — it sees `world.tick` and nothing
// else — but a UI seam sometimes does: the encyclopedia's lens waits `ENCYCLOPEDIA_PREVIEW_SETTLE_MS` for a selection
// to rest before it shows a scene (docs/ui/encyclopedia.md §11.4). Such a caller injects a `Scheduler` rather than
// reaching for the global, so the delay is visible in its dependencies and a test can drive it.
//
// It is **not** a way into game logic: a delay measured in wall milliseconds may decide when something is *drawn*,
// never what the simulation does. Nothing on the server takes one — `IntervalTicker` is the server's one timer.

/** Cancels a call that has not run yet. Calling it after the call ran, or twice, does nothing. */
export type CancelDeferredCall = () => void;

export interface Scheduler {
  /** Runs `callback` once, `delayMilliseconds` from now. */
  after(delayMilliseconds: number, callback: () => void): CancelDeferredCall;
}

/** Production scheduler over the platform's timer (Node and browsers); the one allowed `setTimeout` in shared. */
export class SystemScheduler implements Scheduler {
  after(delayMilliseconds: number, callback: () => void): CancelDeferredCall {
    const handle = setTimeout(callback, delayMilliseconds);
    return () => clearTimeout(handle);
  }
}

/** Test scheduler: a deferred call runs when the test advances time past it, in the order the calls were made. */
export class ManualScheduler implements Scheduler {
  private pending: { dueAtMilliseconds: number; callback: () => void }[] = [];
  private nowMilliseconds = 0;

  after(delayMilliseconds: number, callback: () => void): CancelDeferredCall {
    const call = { dueAtMilliseconds: this.nowMilliseconds + delayMilliseconds, callback };
    this.pending.push(call);
    return () => {
      this.pending = this.pending.filter((one) => one !== call);
    };
  }

  /** Runs every call now due, oldest first. A call made by one of them is due on a later advance, never this one. */
  advanceMilliseconds(delta: number): void {
    this.nowMilliseconds += delta;
    const due = this.pending.filter((call) => call.dueAtMilliseconds <= this.nowMilliseconds);
    this.pending = this.pending.filter((call) => call.dueAtMilliseconds > this.nowMilliseconds);
    for (const call of due) call.callback();
  }

  get pendingCallCount(): number {
    return this.pending.length;
  }
}
