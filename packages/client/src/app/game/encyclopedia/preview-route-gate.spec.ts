// The production gate of the preview evidence route (docs/architecture/encyclopedia.md §12.7): `?preview` decides it,
// and only in a dev build. The token is read once per page, so these cases are what the shell can ever see.
import { DOCUMENT } from '@angular/common';
import { isDevMode } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { IS_PREVIEW_ROUTE, isPreviewRouteEnabled } from './preview-route-gate';

function documentWith(search: string | null): Document {
  return { defaultView: search === null ? null : { location: { search } } } as unknown as Document;
}

function tokenFor(search: string | null): boolean {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: documentWith(search) }] });
  return TestBed.inject(IS_PREVIEW_ROUTE);
}

describe('isPreviewRouteEnabled', () => {
  it('needs both a dev build and a `preview` query', () => {
    expect(isPreviewRouteEnabled(true, '?preview=cell_kind:amoeboid&t=2')).toBe(true);
    expect(isPreviewRouteEnabled(true, '?preview')).toBe(true);
    expect(isPreviewRouteEnabled(true, '?t=2&opens=20')).toBe(false);
    expect(isPreviewRouteEnabled(true, '')).toBe(false);
    expect(isPreviewRouteEnabled(false, '?preview=zone:warm_vent'), 'production never renders it').toBe(false);
    expect(isPreviewRouteEnabled(true, null), 'nor a page with no window to read the query from').toBe(false);
  });
});

describe('IS_PREVIEW_ROUTE', () => {
  it('reads the query of the injected document', () => {
    expect(isDevMode(), 'the unit tests run as a dev build, so the token turns on the query alone').toBe(true);
    expect(tokenFor('?preview=zone:warm_vent')).toBe(true);
    expect(tokenFor('?bench=42')).toBe(false);
    expect(tokenFor(null)).toBe(false);
  });
});
