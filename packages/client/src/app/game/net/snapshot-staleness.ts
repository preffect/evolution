// Whether the snapshots have stopped coming while the socket is up (docs/ui/overlays.md §3.6): the connection
// banner's `stale` state. Every arrival restarts one `SNAPSHOT_STALE_MS` wait through the injected `Scheduler`
// (nothing in `game/` reads the wall clock); the wait running out is the only thing that makes the flag true.

import { signal } from '@angular/core';
import { SNAPSHOT_STALE_MS, type CancelDeferredCall, type Scheduler } from '@evolution/shared';

export class SnapshotStalenessWatch {
  private readonly isStaleValue = signal(false);
  private cancelWait: CancelDeferredCall | null = null;

  /** True once `SNAPSHOT_STALE_MS` has passed since the last `restart()` with no other in between. */
  readonly isStale = this.isStaleValue.asReadonly();

  constructor(private readonly scheduler: Scheduler) {}

  /** A snapshot arrived, or the socket reopened on a room: fresh again, and the wait starts over. */
  restart(): void {
    this.stop();
    this.cancelWait = this.scheduler.after(SNAPSHOT_STALE_MS, () => {
      this.cancelWait = null;
      this.isStaleValue.set(true);
    });
  }

  /** Nothing to wait for (the socket is down, or there is no room): never stale. */
  stop(): void {
    this.cancelWait?.();
    this.cancelWait = null;
    this.isStaleValue.set(false);
  }
}
