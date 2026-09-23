// docs/ui/encyclopedia.md §11.5: the session's reading position, its back stack and its query, over the registry read
// through `EncyclopediaContextService`. The empty-category rule is pinned as a rule — every listed category has
// entries and every unlisted one has none — so it holds whichever categories have content.

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, type BalanceConfig } from '@evolution/shared';
import { GameStateService } from '../state/game-state.service';
import { ENCYCLOPEDIA_HISTORY_MAX } from './encyclopedia-constants';
import { LISTED_ENCYCLOPEDIA_CATEGORIES, EncyclopediaStateService } from './encyclopedia-state.service';
import { categoryLanding } from './format/navigation';
import { SEARCH_MATCH } from './format/search';
import { ENCYCLOPEDIA_CATEGORY_ORDER } from './model/categories';
import type { EntryId } from './model/entry-id';
import { entriesIn } from './registry';

const MITOCHONDRION: EntryId = 'trait:mitochondrion';
const CILIA: EntryId = 'trait:cilia';

function setUp(): { service: EncyclopediaStateService; balance: ReturnType<typeof signal<BalanceConfig | null>> } {
  const balance = signal<BalanceConfig | null>(null);
  TestBed.configureTestingModule({ providers: [{ provide: GameStateService, useValue: { balance } }] });
  return { service: TestBed.inject(EncyclopediaStateService), balance };
}

describe('LISTED_ENCYCLOPEDIA_CATEGORIES', () => {
  // This guards the predicate at the call site — that the service really asks `entriesIn` and not something else. The
  // rule itself is pinned where it can fail as a property: `navigation.spec.ts` drives `listedCategories` with
  // injected predicates, and the default-open case below asserts the landing shown has entries.
  it('asks entriesIn, so a category is listed exactly when it has entries', () => {
    for (const category of ENCYCLOPEDIA_CATEGORY_ORDER) {
      expect({ category, listed: LISTED_ENCYCLOPEDIA_CATEGORIES.includes(category) }).toEqual({
        category,
        listed: entriesIn(category).length > 0,
      });
    }
  });

  it('lists at least one category, so the rail is never blank', () => {
    expect(LISTED_ENCYCLOPEDIA_CATEGORIES.length).toBeGreaterThan(0);
  });
});

describe('EncyclopediaStateService', () => {
  it('opens on a landing of a category that has entries, never on an empty one', () => {
    const { service } = setUp();

    expect(service.location().entryId).toBeNull();
    expect(entriesIn(service.location().category).length).toBeGreaterThan(0);
    expect(service.canGoBack()).toBe(false);
    expect(service.categories).toEqual(LISTED_ENCYCLOPEDIA_CATEGORIES);
  });

  it('follows a link to the entry’s own category and walks back to where it started', () => {
    const { service } = setUp();
    const start = service.location();

    service.openEntry(MITOCHONDRION);
    expect(service.location()).toEqual({ category: 'evolutions', entryId: MITOCHONDRION, sectionKey: null });
    expect(service.canGoBack()).toBe(true);

    service.goBack();
    expect(service.location()).toEqual(start);
    expect(service.canGoBack()).toBe(false);
  });

  it('selects a category’s landing and lists that category’s groups', () => {
    const { service } = setUp();
    const category = LISTED_ENCYCLOPEDIA_CATEGORIES[0];
    if (category === undefined) throw new Error('The registry listed no category');

    service.openEntry(MITOCHONDRION);
    service.selectCategory(category);

    expect(service.location()).toEqual(categoryLanding(category));
    expect(service.groups()).toEqual(entriesIn(category));
    expect(service.groups().every((group) => group.entries.length > 0)).toBe(true);
  });

  it('resolves the page being read, and nothing on a landing', () => {
    const { service } = setUp();

    expect(service.entry()).toBeNull();

    service.openEntry(MITOCHONDRION);
    expect(service.entry()?.id).toBe(MITOCHONDRION);
    expect(service.entry()?.title).toBe('Mitochondrion');
  });

  it('re-resolves the open page when the room’s balance changes, so a patch reaches it', () => {
    const { service, balance } = setUp();
    service.openEntry(MITOCHONDRION);
    const shipped = service.entry();

    balance.set(structuredClone(DEFAULT_BALANCE) as BalanceConfig);

    expect(service.entry()).not.toBe(shipped);
    expect(service.entry()?.id).toBe(MITOCHONDRION);
  });

  it('matches the registry’s own entries, and matches nothing while the query is blank', () => {
    const { service } = setUp();

    expect(service.results()).toEqual([]);

    service.setQuery('mitoch');
    // Enter opens the first result (§11.5), so the title-prefix match is the one that has to lead.
    expect(service.results()[0]).toMatchObject({ entryId: MITOCHONDRION, match: SEARCH_MATCH.titlePrefix });

    service.clearQuery();
    expect(service.results()).toEqual([]);
  });

  it('cuts the matches into one section per category, in result order', () => {
    const { service } = setUp();
    service.setQuery('cil');

    const groups = service.resultGroups();
    const categories = groups.map((group) => group.category);

    expect(new Set(categories).size).toBe(categories.length);
    expect(groups.flatMap((group) => group.results)).toEqual(service.results());
  });

  it('roves without pushing, so arrowing through a list leaves Back where the reader came from', () => {
    const { service } = setUp();
    const start = service.location();
    const listed = LISTED_ENCYCLOPEDIA_CATEGORIES[0];
    if (listed === undefined) throw new Error('The registry listed no category');

    service.openEntry(CILIA);
    for (let step = 0; step < ENCYCLOPEDIA_HISTORY_MAX * 2; step += 1) {
      service.focusEntry(step % 2 === 0 ? MITOCHONDRION : CILIA);
      service.focusCategory(listed);
    }

    service.goBack();
    expect(service.location()).toEqual(start);
    expect(service.canGoBack()).toBe(false);
  });

  it('drops the query from the closing side too, so a reopen never shows a stale search', () => {
    const { service } = setUp();
    service.setQuery('mitoch');

    service.close();

    expect(service.query()).toBe('');
    expect(service.results()).toEqual([]);
  });

  it('opens at the entry a host asked for, and stays where it was when it asks for nothing', () => {
    const { service } = setUp();
    service.openEntry(CILIA);
    service.setQuery('mitoch');

    service.openAt(null);
    expect(service.location().entryId).toBe(CILIA);
    expect(service.query()).toBe('');

    service.openAt(MITOCHONDRION);
    expect(service.location().entryId).toBe(MITOCHONDRION);
  });
});
