// Whether this page is the dev-only preview evidence route (docs/architecture/encyclopedia.md §12.7): `?preview` in
// the query of a dev build. Read once through a token so the shell and its tests decide it without touching `window`;
// production builds never render the route, whatever the query says. The gate lives apart from the route
// (`preview-route.ts`) so the shell can read it without shipping the route (#423,
// `development-route/development-route-loader.ts`).
import { DOCUMENT } from '@angular/common';
import { InjectionToken, inject, isDevMode } from '@angular/core';

/** `?preview=<EntryAnchor>` selects the route; its value is the entry the route previews (`preview-route.ts`). */
export const PREVIEW_PARAMETER = 'preview';

export function isPreviewRoute(search: string): boolean {
  return new URLSearchParams(search).has(PREVIEW_PARAMETER);
}

/** The gate itself: both halves, so a spec can pin the production one without a production build. */
export function isPreviewRouteEnabled(isDevelopmentBuild: boolean, search: string | null): boolean {
  return isDevelopmentBuild && search !== null && isPreviewRoute(search);
}

export const IS_PREVIEW_ROUTE = new InjectionToken<boolean>('IsPreviewRoute', {
  providedIn: 'root',
  factory: () => isPreviewRouteEnabled(isDevMode(), inject(DOCUMENT).defaultView?.location.search ?? null),
});
