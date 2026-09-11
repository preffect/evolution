// The client's one injected clock (docs/DETERMINISM.md §2, docs/CODE-STANDARDS.md §8): game code
// under `app/game/` reads time through this token, never through the wall clock. Tests provide a
// `ManualClock`.

import { InjectionToken } from '@angular/core';
import { SystemClock, type Clock } from '@evolution/shared';

export const CLOCK = new InjectionToken<Clock>('Clock', { providedIn: 'root', factory: () => new SystemClock() });
