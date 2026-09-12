// Whether this page is the dev-only bench route (docs/RENDERING.md §7): `?bench` in the query of a
// dev build. Read once through a token so the shell and its tests decide it without touching
// `window`; production builds never render the bench, whatever the query says.

import { DOCUMENT } from '@angular/common';
import { InjectionToken, inject, isDevMode } from '@angular/core';
import { isBenchRoute } from './bench-session';

/** The gate itself: both halves, so a spec can pin the production one without a dev build. */
export function isBenchRouteEnabled(isDevelopmentBuild: boolean, search: string | null): boolean {
  return isDevelopmentBuild && search !== null && isBenchRoute(search);
}

export const IS_BENCH_ROUTE = new InjectionToken<boolean>('IsBenchRoute', {
  providedIn: 'root',
  factory: () => isBenchRouteEnabled(isDevMode(), inject(DOCUMENT).defaultView?.location.search ?? null),
});
