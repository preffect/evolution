// Whether this page is the dev-only trait card sheet: `?cards` in the query of a dev build (#428). Read once through
// a token, like the UI kit states page, so the shell and its tests decide it without touching `window`; production
// builds never render it, whatever the query says.

import { DOCUMENT } from '@angular/common';
import { InjectionToken, inject, isDevMode } from '@angular/core';
import { CARD_SHEET_QUERY_KEY } from './card-sheet-query';

/** The gate itself: both halves, so a spec can pin the production one without a production build. */
export function isCardSheetRouteEnabled(isDevelopmentBuild: boolean, search: string | null): boolean {
  return isDevelopmentBuild && search !== null && new URLSearchParams(search).has(CARD_SHEET_QUERY_KEY);
}

export const IS_CARD_SHEET_ROUTE = new InjectionToken<boolean>('IsCardSheetRoute', {
  providedIn: 'root',
  factory: () => isCardSheetRouteEnabled(isDevMode(), inject(DOCUMENT).defaultView?.location.search ?? null),
});
