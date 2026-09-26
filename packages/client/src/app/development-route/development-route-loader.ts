// Loads a dev-only page's component on demand (#423). The four pages are reachable only through the dynamic
// imports below, never a static one (pinned by `development-route-bundle.spec.ts`), and those imports sit behind
// `ngDevMode`: the production build defines it as `false`, so esbuild drops the branch and emits no chunk for any of
// them. The gate is `ngDevMode` rather than `isDevMode()` because a function call is not a constant the bundler can
// fold.
import { InjectionToken, inject, signal, type Signal, type Type } from '@angular/core';
import { DEVELOPMENT_ROUTE, type DevelopmentRoute } from './development-route';

/** The page's component, or `null` when this build carries none (production). */
export type DevelopmentRouteComponentLoader = (route: DevelopmentRoute) => Promise<Type<unknown>> | null;

export function loadDevelopmentRouteComponent(route: DevelopmentRoute): Promise<Type<unknown>> | null {
  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    switch (route) {
      case DEVELOPMENT_ROUTE.bench:
        return import('../game/render/bench/render-bench.component').then((module) => module.RenderBenchComponent);
      case DEVELOPMENT_ROUTE.preview:
        return import('../game/encyclopedia/preview-route.component').then(
          (module) => module.EncyclopediaPreviewRouteComponent,
        );
      case DEVELOPMENT_ROUTE.uiKitStates:
        return import('../ui-kit/kit-states/kit-states.component').then((module) => module.UiKitStatesComponent);
      case DEVELOPMENT_ROUTE.cardSheet:
        return import('../game/hud/card-sheet/card-sheet.component').then((module) => module.TraitCardSheetComponent);
    }
  }
  return null;
}

/** A seam, so the shell's specs can stand a stub in for a page that would need WebGL. */
export const DEVELOPMENT_ROUTE_COMPONENT_LOADER = new InjectionToken<DevelopmentRouteComponentLoader>(
  'DevelopmentRouteComponentLoader',
  {
    providedIn: 'root',
    factory: () => loadDevelopmentRouteComponent,
  },
);

/**
 * The component for `route` once it has loaded; `null` before then, and for good when there is no route or its chunk
 * fails to load (logged, naming the page: a dev server restarted mid-load, a stale prebundle).
 */
export function injectDevelopmentRouteComponent(route: DevelopmentRoute | null): Signal<Type<unknown> | null> {
  const component = signal<Type<unknown> | null>(null);
  const loading = route === null ? null : inject(DEVELOPMENT_ROUTE_COMPONENT_LOADER)(route);
  void loading
    ?.then((loaded) => component.set(loaded))
    .catch((error: unknown) => console.error(`The dev page "${route}" could not load; the page stays blank.`, error));
  return component.asReadonly();
}
