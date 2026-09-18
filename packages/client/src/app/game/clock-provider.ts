// The client's one injected clock (docs/determinism/contract-and-clock.md §2, docs/CODE-STANDARDS.md §8): game code
// under `app/game/` reads time through this token, never through the wall clock. Tests provide a
// `ManualClock`.

import { InjectionToken } from '@angular/core';
import { SystemClock, SystemScheduler, type Clock, type Scheduler } from '@evolution/shared';

export const CLOCK = new InjectionToken<Clock>('Clock', { providedIn: 'root', factory: () => new SystemClock() });

/**
 * The same rule for a *delayed* call: `setTimeout` is banned in game code (§1), so a UI seam that has to wait —
 * the encyclopedia lens settling a selection (docs/ui/encyclopedia.md §11.4) — injects this. A delay may decide
 * when something is drawn and never what the simulation does; tests provide a `ManualScheduler`, or drive the
 * system one with the test runner's own fake timers.
 */
export const SCHEDULER = new InjectionToken<Scheduler>('Scheduler', {
  providedIn: 'root',
  factory: () => new SystemScheduler(),
});
