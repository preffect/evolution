// Which dev-only page the shell shows (#423): at most one, the first of the precedence the query enables, and none in
// the lobby or a room.
import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import {
  ACTIVE_DEVELOPMENT_ROUTE,
  DEVELOPMENT_ROUTE,
  DEVELOPMENT_ROUTE_PRECEDENCE,
  activeDevelopmentRoute,
  type DevelopmentRoute,
} from './development-route';

const NONE_ENABLED: Readonly<Record<DevelopmentRoute, boolean>> = {
  [DEVELOPMENT_ROUTE.bench]: false,
  [DEVELOPMENT_ROUTE.preview]: false,
  [DEVELOPMENT_ROUTE.uiKitStates]: false,
  [DEVELOPMENT_ROUTE.cardSheet]: false,
};

function activeRouteFor(search: string | null): DevelopmentRoute | null {
  const documentLike = { defaultView: search === null ? null : { location: { search } } } as unknown as Document;
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: documentLike }] });
  return TestBed.inject(ACTIVE_DEVELOPMENT_ROUTE);
}

describe('activeDevelopmentRoute', () => {
  it('is null when no page is enabled', () => {
    expect(activeDevelopmentRoute(NONE_ENABLED)).toBeNull();
  });

  it('picks each page alone', () => {
    for (const route of DEVELOPMENT_ROUTE_PRECEDENCE)
      expect(activeDevelopmentRoute({ ...NONE_ENABLED, [route]: true })).toBe(route);
  });

  it('picks the earlier page when several are enabled', () => {
    expect(
      activeDevelopmentRoute({
        ...NONE_ENABLED,
        [DEVELOPMENT_ROUTE.cardSheet]: true,
        [DEVELOPMENT_ROUTE.uiKitStates]: true,
      }),
    ).toBe(DEVELOPMENT_ROUTE.uiKitStates);
    expect(
      activeDevelopmentRoute({ ...NONE_ENABLED, [DEVELOPMENT_ROUTE.preview]: true, [DEVELOPMENT_ROUTE.bench]: true }),
    ).toBe(DEVELOPMENT_ROUTE.bench);
  });

  it('ranks every page exactly once', () => {
    expect([...DEVELOPMENT_ROUTE_PRECEDENCE].sort()).toEqual(Object.values(DEVELOPMENT_ROUTE).sort());
  });
});

describe('ACTIVE_DEVELOPMENT_ROUTE', () => {
  it("reads each page's gate from the injected document's query", () => {
    expect(activeRouteFor('?bench=42')).toBe(DEVELOPMENT_ROUTE.bench);
    expect(activeRouteFor('?preview=zone:warm_vent')).toBe(DEVELOPMENT_ROUTE.preview);
    expect(activeRouteFor('?kit&sheet=collections')).toBe(DEVELOPMENT_ROUTE.uiKitStates);
    expect(activeRouteFor('?cards')).toBe(DEVELOPMENT_ROUTE.cardSheet);
    expect(activeRouteFor('?kit&cards')).toBe(DEVELOPMENT_ROUTE.uiKitStates);
  });

  it('is null for the game itself', () => {
    expect(activeRouteFor('')).toBeNull();
    expect(activeRouteFor('?zoom=1')).toBeNull();
    expect(activeRouteFor(null)).toBeNull();
  });
});
