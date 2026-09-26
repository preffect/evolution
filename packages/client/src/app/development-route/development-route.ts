// The dev-only pages a dev build opens by query instead of the lobby: the render bench (`?bench`), the encyclopedia
// preview evidence route (`?preview`), the UI kit states page (`?kit`) and the trait card sheet (`?cards`). The shell
// picks at most one, synchronously, from each page's light gate token; the page itself is loaded on demand by
// `development-route-loader.ts`, so a production build never ships it (#423).

import { InjectionToken, inject } from '@angular/core';
import type { ValueOf } from '@evolution/shared';
import { IS_PREVIEW_ROUTE } from '../game/encyclopedia/preview-route-gate';
import { IS_CARD_SHEET_ROUTE } from '../game/hud/card-sheet/card-sheet-route';
import { IS_BENCH_ROUTE } from '../game/render/bench/bench-route';
import { IS_UI_KIT_STATES_ROUTE } from '../ui-kit/kit-states/kit-states-route';

export const DEVELOPMENT_ROUTE = {
  bench: 'bench',
  preview: 'preview',
  uiKitStates: 'uiKitStates',
  cardSheet: 'cardSheet',
} as const;
export type DevelopmentRoute = ValueOf<typeof DEVELOPMENT_ROUTE>;

/** Which page wins when a query names several: the order the shell has always tested them in. */
export const DEVELOPMENT_ROUTE_PRECEDENCE: readonly DevelopmentRoute[] = [
  DEVELOPMENT_ROUTE.bench,
  DEVELOPMENT_ROUTE.preview,
  DEVELOPMENT_ROUTE.uiKitStates,
  DEVELOPMENT_ROUTE.cardSheet,
];

export function activeDevelopmentRoute(
  isEnabled: Readonly<Record<DevelopmentRoute, boolean>>,
): DevelopmentRoute | null {
  return DEVELOPMENT_ROUTE_PRECEDENCE.find((route) => isEnabled[route]) ?? null;
}

/** The dev page this page is, or `null` for the game (always `null` in production: every gate is off there). */
export const ACTIVE_DEVELOPMENT_ROUTE = new InjectionToken<DevelopmentRoute | null>('ActiveDevelopmentRoute', {
  providedIn: 'root',
  factory: () =>
    activeDevelopmentRoute({
      [DEVELOPMENT_ROUTE.bench]: inject(IS_BENCH_ROUTE),
      [DEVELOPMENT_ROUTE.preview]: inject(IS_PREVIEW_ROUTE),
      [DEVELOPMENT_ROUTE.uiKitStates]: inject(IS_UI_KIT_STATES_ROUTE),
      [DEVELOPMENT_ROUTE.cardSheet]: inject(IS_CARD_SHEET_ROUTE),
    }),
});
