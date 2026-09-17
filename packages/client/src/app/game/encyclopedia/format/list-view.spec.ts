import { describe, expect, it } from 'vitest';
import {
  ENCYCLOPEDIA_NO_MATCH_PREFIX,
  ENCYCLOPEDIA_NO_MATCH_SUFFIX,
  ENCYCLOPEDIA_RESULTS_LABEL,
} from '../encyclopedia-constants';
import { ENCYCLOPEDIA_CATEGORY, ENCYCLOPEDIA_CATEGORY_LABEL } from '../model/categories';
import type { EntryLink, ResolvedGroup } from '../model/entry';
import type { EntryId } from '../model/entry-id';
import { ENTRY_GROUP, ENTRY_GROUP_LABEL } from '../model/groups';
import { SEARCH_MATCH, type EncyclopediaSearchGroup, type EncyclopediaSearchResult } from './search';
import {
  categoryListHeader,
  categoryListSections,
  entryCountIn,
  entryIdFromItemId,
  noMatchTextFor,
  searchListHeader,
  searchListSections,
} from './list-view';

function link(entryId: string, title: string): EntryLink {
  return { entryId: entryId as EntryId, title };
}

const CELLS: ResolvedGroup = {
  group: ENTRY_GROUP.cells,
  entries: [link('cell_kind:player', 'Player cell'), link('cell_kind:wild', 'Wild cell')],
};
const FOOD: ResolvedGroup = { group: ENTRY_GROUP.food, entries: [link('food:algae', 'Algae mote')] };
const UNGROUPED: ResolvedGroup = { group: null, entries: [link('ability:toxin', 'Toxin')] };

function result(entryId: string, category: EncyclopediaSearchResult['category'], title: string) {
  return { entryId: entryId as EntryId, category, title, match: SEARCH_MATCH.title };
}

describe('entryCountIn (docs/ui/encyclopedia.md §11.2)', () => {
  it('counts every entry across every group, not the groups', () => {
    expect(entryCountIn([CELLS, FOOD])).toBe(3);
  });

  it('counts nothing in a category with no group at all', () => {
    expect(entryCountIn([])).toBe(0);
  });
});

describe('categoryListSections (docs/ui/encyclopedia.md §11.2)', () => {
  it('heads each group when the category has more than one', () => {
    expect(categoryListSections([CELLS, FOOD]).map((section) => section.heading)).toEqual([
      ENTRY_GROUP_LABEL[ENTRY_GROUP.cells],
      ENTRY_GROUP_LABEL[ENTRY_GROUP.food],
    ]);
  });

  it('heads nothing when the category has one group: the header would repeat the column header', () => {
    expect(categoryListSections([CELLS]).map((section) => section.heading)).toEqual([null]);
  });

  it('heads nothing for an ungrouped category, however its single group is shaped', () => {
    expect(categoryListSections([UNGROUPED]).map((section) => section.heading)).toEqual([null]);
  });

  it('keeps the entries and their order untouched, group by group', () => {
    expect(categoryListSections([CELLS, FOOD]).map((section) => section.entries)).toEqual([
      CELLS.entries,
      FOOD.entries,
    ]);
  });

  it('gives each section a key distinct from its neighbours, so a re-render keeps its rows', () => {
    const keys = categoryListSections([CELLS, FOOD, UNGROUPED]).map((section) => section.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('searchListSections (docs/ui/encyclopedia.md §11.5)', () => {
  const groups: readonly EncyclopediaSearchGroup[] = [
    {
      category: ENCYCLOPEDIA_CATEGORY.evolutions,
      results: [result('trait:mitochondrion', ENCYCLOPEDIA_CATEGORY.evolutions, 'Mitochondrion')],
    },
    {
      category: ENCYCLOPEDIA_CATEGORY.entities,
      results: [result('bacterium:aerobic', ENCYCLOPEDIA_CATEGORY.entities, 'Aerobic bacterium')],
    },
  ];

  it('heads every run with its category, since a result list mixes them', () => {
    expect(searchListSections(groups).map((section) => section.heading)).toEqual([
      ENCYCLOPEDIA_CATEGORY_LABEL[ENCYCLOPEDIA_CATEGORY.evolutions],
      ENCYCLOPEDIA_CATEGORY_LABEL[ENCYCLOPEDIA_CATEGORY.entities],
    ]);
  });

  it('keeps the categories in the order search ranked them, not in rail order', () => {
    expect(searchListSections(groups).map((section) => section.key)).toEqual([
      ENCYCLOPEDIA_CATEGORY.evolutions,
      ENCYCLOPEDIA_CATEGORY.entities,
    ]);
  });

  it('carries each result across as the row it draws: its id and its resolved title', () => {
    expect(searchListSections(groups)[0]?.entries).toEqual([link('trait:mitochondrion', 'Mitochondrion')]);
  });
});

describe('the list header (docs/ui/encyclopedia.md §11.3, §11.5)', () => {
  it('names the category and counts its entries', () => {
    expect(categoryListHeader(ENCYCLOPEDIA_CATEGORY.entities, [CELLS, FOOD])).toEqual({
      label: ENCYCLOPEDIA_CATEGORY_LABEL[ENCYCLOPEDIA_CATEGORY.entities],
      count: 3,
    });
  });

  it('names the results and counts them while a query is running, since no category is selected', () => {
    const results = [result('trait:mitochondrion', ENCYCLOPEDIA_CATEGORY.evolutions, 'Mitochondrion')];
    expect(searchListHeader(results)).toEqual({ label: ENCYCLOPEDIA_RESULTS_LABEL, count: 1 });
  });
});

describe('entryIdFromItemId (docs/ui/encyclopedia.md §11.3)', () => {
  const sections = categoryListSections([CELLS, FOOD]);

  it('finds an entry in a later section, not only in the first', () => {
    expect(entryIdFromItemId('food:algae', sections)).toBe('food:algae');
  });

  it('refuses an id the column is not showing, so a stale selection moves the reader nowhere', () => {
    expect(entryIdFromItemId('trait:mitochondrion', sections)).toBeNull();
    expect(entryIdFromItemId(null, sections)).toBeNull();
  });
});

describe('noMatchTextFor (docs/ui/encyclopedia.md §11.5)', () => {
  it('quotes the query exactly as it was typed, spaces and case and all', () => {
    expect(noMatchTextFor('  Xyz ')).toBe(`${ENCYCLOPEDIA_NO_MATCH_PREFIX}  Xyz ${ENCYCLOPEDIA_NO_MATCH_SUFFIX}`);
  });
});
