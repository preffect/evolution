// Whether this page is the dev-only UI kit states page: `?kit` in the query of a dev build. Read once through a
// token, like the bench route (docs/rendering/budget.md §7), so the shell and its tests decide it without
// touching `window`; production builds never render it, whatever the query says.

import { DOCUMENT } from '@angular/common';
import { InjectionToken, inject, isDevMode } from '@angular/core';

export const UI_KIT_STATES_QUERY_KEY = 'kit';

/** The gate itself: both halves, so a spec can pin the production one without a dev build. */
export function isUiKitStatesRouteEnabled(isDevelopmentBuild: boolean, search: string | null): boolean {
  return isDevelopmentBuild && search !== null && new URLSearchParams(search).has(UI_KIT_STATES_QUERY_KEY);
}

export const IS_UI_KIT_STATES_ROUTE = new InjectionToken<boolean>('IsUiKitStatesRoute', {
  providedIn: 'root',
  factory: () => isUiKitStatesRouteEnabled(isDevMode(), inject(DOCUMENT).defaultView?.location.search ?? null),
});

/** `?kit` alone is the states sheet (buttons, panels); `?kit&sheet=collections` the rail, list and the rest. */
export const UI_KIT_SHEET_QUERY_KEY = 'sheet';
export const KIT_SHEET = { states: 'states', collections: 'collections' } as const;
export type KitSheet = (typeof KIT_SHEET)[keyof typeof KIT_SHEET];

export function kitSheetFor(search: string | null): KitSheet {
  const requested = search === null ? null : new URLSearchParams(search).get(UI_KIT_SHEET_QUERY_KEY);
  return requested === KIT_SHEET.collections ? KIT_SHEET.collections : KIT_SHEET.states;
}

export const UI_KIT_SHEET = new InjectionToken<KitSheet>('UiKitSheet', {
  providedIn: 'root',
  factory: () => kitSheetFor(inject(DOCUMENT).defaultView?.location.search ?? null),
});
