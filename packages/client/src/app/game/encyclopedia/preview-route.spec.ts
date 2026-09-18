// The preview evidence route (docs/architecture/encyclopedia.md §12.7, §12.9): its production gate, the query it
// parses and the anchor it joins to a render spec. The walk arithmetic and the budget verdict are
// `render/preview/preview-timings.spec.ts`: `encyclopedia/` reads no tunable from a module import (§12.6).
//
// **What no jsdom spec can prove.** The route's reason for walking is that clips start at the frame's `nowMs`, and
// the clip tracker lives inside `GameRenderer`, which needs WebGL. jsdom has none. So the equality of a walked
// frame and a live one at the same `t` is the Playwright smoke's `same t ⇒ same pixels` check, not a unit one.

import { DOCUMENT } from '@angular/common';
import { isDevMode } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ZONE_ID } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { PREVIEW_SCENE } from '../render/preview/preview-spec';
import { ENCYCLOPEDIA_ENTRIES } from './registry';
import {
  IS_PREVIEW_ROUTE,
  PREVIEW_ROUTE_DEFAULT_OPENS,
  PREVIEW_ROUTE_DEFAULT_SECONDS,
  PREVIEW_ROUTE_FALLBACK_SPEC,
  PREVIEW_ROUTE_SCENE_SPECS,
  isPreviewRouteEnabled,
  parsePreviewQuery,
  previewSpecForAnchor,
} from './preview-route';

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

describe('parsePreviewQuery', () => {
  it('reads the anchor, the park time and the open count, each with its default', () => {
    expect(parsePreviewQuery('?preview=trait:cilia%23tier_2&t=2.5&opens=20')).toEqual({
      anchor: 'trait:cilia#tier_2',
      parkAtSeconds: 2.5,
      opens: 20,
    });
    expect(parsePreviewQuery('?preview')).toEqual({
      anchor: null,
      parkAtSeconds: PREVIEW_ROUTE_DEFAULT_SECONDS,
      opens: PREVIEW_ROUTE_DEFAULT_OPENS,
    });
  });

  it('falls back rather than parking at a negative time or opening zero sessions', () => {
    const query = parsePreviewQuery('?preview=zone&t=-3&opens=0');
    expect(query.parkAtSeconds).toBe(PREVIEW_ROUTE_DEFAULT_SECONDS);
    expect(query.opens).toBe(PREVIEW_ROUTE_DEFAULT_OPENS);
    expect(parsePreviewQuery('?preview=zone:warm_vent&t=nonsense').parkAtSeconds).toBe(PREVIEW_ROUTE_DEFAULT_SECONDS);
  });
});

describe('previewSpecForAnchor', () => {
  it('falls back for no anchor and for an anchor that names no entry', () => {
    expect(previewSpecForAnchor(null)).toEqual(PREVIEW_ROUTE_FALLBACK_SPEC);
    expect(previewSpecForAnchor('concept:nothing_like_this')).toEqual(PREVIEW_ROUTE_FALLBACK_SPEC);
    expect(PREVIEW_ROUTE_FALLBACK_SPEC).toEqual({ scene: PREVIEW_SCENE.zone, zone: ZONE_ID.openBroth });
  });

  /** A bare scene name reaches a family the registry has no entry for yet: the evidence route never waits on content. */
  it('reaches every PREVIEW_SCENE family by its own name', () => {
    for (const scene of Object.values(PREVIEW_SCENE)) {
      expect(previewSpecForAnchor(scene).scene, scene).toBe(PREVIEW_ROUTE_SCENE_SPECS[scene].scene);
    }
    expect(previewSpecForAnchor(PREVIEW_SCENE.food)).toEqual(PREVIEW_ROUTE_SCENE_SPECS[PREVIEW_SCENE.food]);
  });

  /**
   * The route is the one module allowed to join an entry id to a render spec. Content lands entry by entry, so
   * this walks whatever the registry holds today rather than naming an entry that a later ticket may rename.
   */
  it('returns an entry’s own preview wherever the registry has one', () => {
    const withPreview = ENCYCLOPEDIA_ENTRIES.filter((definition) => definition.preview !== null);
    for (const definition of withPreview) {
      expect(previewSpecForAnchor(definition.id), definition.id).toEqual(definition.preview);
    }
    const withSectionPreview = ENCYCLOPEDIA_ENTRIES.flatMap((definition) =>
      definition.sections
        .filter((section) => section.preview !== null)
        .map((section) => ({ anchor: `${definition.id}#${section.key}`, preview: section.preview })),
    );
    for (const { anchor, preview } of withSectionPreview) {
      expect(previewSpecForAnchor(anchor), anchor).toEqual(preview);
    }
  });

  it('keeps the entry’s preview for a section that re-points nothing', () => {
    const entry = ENCYCLOPEDIA_ENTRIES.find(
      (definition) => definition.preview !== null && definition.sections.some((section) => section.preview === null),
    );
    if (entry === undefined) return;
    const plain = entry.sections.find((section) => section.preview === null)!;
    expect(previewSpecForAnchor(`${entry.id}#${plain.key}`)).toEqual(entry.preview);
  });
});
