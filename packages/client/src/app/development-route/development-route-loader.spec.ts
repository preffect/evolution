// Loading a dev-only page on demand (#423). The unit tests run as a dev build, so every page loads here; that the
// production build drops them is `development-route-bundle.spec.ts`.
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { EncyclopediaPreviewRouteComponent } from '../game/encyclopedia/preview-route.component';
import { TraitCardSheetComponent } from '../game/hud/card-sheet/card-sheet.component';
import { RenderBenchComponent } from '../game/render/bench/render-bench.component';
import { UiKitStatesComponent } from '../ui-kit/kit-states/kit-states.component';
import { DEVELOPMENT_ROUTE } from './development-route';
import {
  DEVELOPMENT_ROUTE_COMPONENT_LOADER,
  injectDevelopmentRouteComponent,
  loadDevelopmentRouteComponent,
} from './development-route-loader';

@Component({ selector: 'app-dev-page-stub', standalone: true, template: '' })
class DevelopmentPageStubComponent {}

describe('loadDevelopmentRouteComponent', () => {
  it("loads each page's own component", async () => {
    expect(await loadDevelopmentRouteComponent(DEVELOPMENT_ROUTE.bench)).toBe(RenderBenchComponent);
    expect(await loadDevelopmentRouteComponent(DEVELOPMENT_ROUTE.preview)).toBe(EncyclopediaPreviewRouteComponent);
    expect(await loadDevelopmentRouteComponent(DEVELOPMENT_ROUTE.uiKitStates)).toBe(UiKitStatesComponent);
    expect(await loadDevelopmentRouteComponent(DEVELOPMENT_ROUTE.cardSheet)).toBe(TraitCardSheetComponent);
  });

  it('is the default loader', () => {
    expect(TestBed.inject(DEVELOPMENT_ROUTE_COMPONENT_LOADER)).toBe(loadDevelopmentRouteComponent);
  });
});

describe('injectDevelopmentRouteComponent', () => {
  function componentFor(
    route: typeof DEVELOPMENT_ROUTE.bench | null,
    loader = vi.fn(() => Promise.resolve(DevelopmentPageStubComponent)),
  ) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: DEVELOPMENT_ROUTE_COMPONENT_LOADER, useValue: loader }] });
    return { loader, component: TestBed.runInInjectionContext(() => injectDevelopmentRouteComponent(route)) };
  }

  it('is null until the page has loaded, then the page', async () => {
    const { loader, component } = componentFor(DEVELOPMENT_ROUTE.bench);
    expect(loader).toHaveBeenCalledWith(DEVELOPMENT_ROUTE.bench);
    expect(component()).toBeNull();
    await loader.mock.results[0]?.value;
    expect(component()).toBe(DevelopmentPageStubComponent);
  });

  it('loads nothing and stays null when there is no page', () => {
    const { loader, component } = componentFor(null);
    expect(loader).not.toHaveBeenCalled();
    expect(component()).toBeNull();
  });
});
