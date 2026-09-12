// The production gate of the bench route (docs/RENDERING.md §7): `?bench` decides it, and only in a
// dev build. The token is read once per page, so these cases are what the shell can ever see.
import { DOCUMENT } from '@angular/common';
import { isDevMode } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { IS_BENCH_ROUTE, isBenchRouteEnabled } from './bench-route';

/** A document whose window reports `search`; `null` stands for a page rendered without one. */
function documentWith(search: string | null): Document {
  return { defaultView: search === null ? null : { location: { search } } } as unknown as Document;
}

function tokenFor(search: string | null): boolean {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: documentWith(search) }] });
  return TestBed.inject(IS_BENCH_ROUTE);
}

describe('isBenchRouteEnabled', () => {
  it('needs both a dev build and a `bench` query', () => {
    expect(isBenchRouteEnabled(true, '?bench=42&tick=120')).toBe(true);
    expect(isBenchRouteEnabled(true, '?bench')).toBe(true);
    expect(isBenchRouteEnabled(true, '?tick=120&zoom=1')).toBe(false);
    expect(isBenchRouteEnabled(true, '')).toBe(false);
    expect(isBenchRouteEnabled(false, '?bench=42'), 'a production build never renders the bench').toBe(false);
    expect(isBenchRouteEnabled(true, null), 'nor a page without a window to read the query from').toBe(false);
  });
});

describe('IS_BENCH_ROUTE', () => {
  it('reads the query of the injected document', () => {
    expect(isDevMode(), 'the unit tests run as a dev build, so the token turns on the query alone').toBe(true);
    expect(tokenFor('?bench=42')).toBe(true);
    expect(tokenFor('?zoom=1')).toBe(false);
    expect(tokenFor(null)).toBe(false);
  });
});
