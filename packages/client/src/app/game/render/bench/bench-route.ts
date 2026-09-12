// Whether this page is the dev-only bench route (docs/RENDERING.md §7): `?bench` in the query of a
// dev build. Read once through a token so the shell and its tests decide it without touching
// `window`; production builds never render the bench.

import { DOCUMENT } from '@angular/common';
import { InjectionToken, inject, isDevMode } from '@angular/core';
import { isBenchRoute } from './bench-session';

export const IS_BENCH_ROUTE = new InjectionToken<boolean>('IsBenchRoute', {
  providedIn: 'root',
  factory: () => isDevMode() && isBenchRoute(inject(DOCUMENT).defaultView?.location.search ?? ''),
});
