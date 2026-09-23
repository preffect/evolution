// @vitest-environment node
// docs/ui/encyclopedia.md §11.5: search is case- and accent-insensitive, title before summary with a title-prefix
// match ahead of the rest, and the caller's rail-and-list order kept inside each rank.

import { describe, expect, it } from 'vitest';
import { ENCYCLOPEDIA_CATEGORY, type EncyclopediaCategory } from '../model/categories';
import type { ProseSegment } from '../model/entry';
import type { EntryId } from '../model/entry-id';
import {
  SEARCH_MATCH,
  foldForSearch,
  groupSearchResults,
  proseText,
  searchEntries,
  type SearchableEntry,
} from './search';

const EVOLUTIONS: EncyclopediaCategory = ENCYCLOPEDIA_CATEGORY.evolutions;
const ENTITIES: EncyclopediaCategory = ENCYCLOPEDIA_CATEGORY.entities;

function searchable(
  entryId: EntryId,
  title: string,
  summaryText: string,
  category: EncyclopediaCategory = EVOLUTIONS,
): SearchableEntry {
  return { entryId, category, title, summaryText };
}

/**
 * Deliberately out of result order — a summary-only match first, the title-prefix match last — so the expectations
 * below go red if the ranking is dropped and the index order is returned as it stands.
 */
const INDEX: readonly SearchableEntry[] = [
  searchable('trait:cytoskeleton', 'Cytoskeleton Lattice', 'A stiffer frame than cilia give.'),
  searchable('trait:paramecium_cilia', 'Paramecium Cilia', 'Dense rows that sweep food in.'),
  searchable('trait:cilia', 'Cilia Fringe', 'A fringe of beating hairs.'),
];

describe('foldForSearch', () => {
  it('folds case and strips accents, so the accented and plain spellings meet in one form', () => {
    expect(foldForSearch('Paramécium Cília')).toBe(foldForSearch('paramecium cilia'));
    expect(foldForSearch('CILIA')).toBe('cilia');
    // `œ` survives on purpose: NFD decomposes accents but not ligatures or stroked letters, so `œ`, `æ`, `ß` and `ø`
    // stay as typed and `oeil` will not find `Œil`. A stated limit, not an accident — see `foldForSearch`.
    expect(foldForSearch('Über Ångström œil')).toBe('uber angstrom œil');
  });
});

describe('proseText', () => {
  it('reads a resolved summary as the words on screen: text, formatted values and link titles alike', () => {
    const segments: readonly ProseSegment[] = [
      { kind: 'text', text: 'Swim ' },
      { kind: 'value', factKey: 'speedMultiplier', text: '+15 %' },
      { kind: 'text', text: ' faster than ' },
      { kind: 'link', entryId: 'trait:cilia', sectionKey: null, text: 'Cilia Fringe' },
    ];

    expect(proseText(segments)).toBe('Swim +15 % faster than Cilia Fringe');
  });
});

describe('searchEntries', () => {
  it('matches nothing for a blank or whitespace-only query', () => {
    expect(searchEntries(INDEX, '')).toEqual([]);
    expect(searchEntries(INDEX, '   ')).toEqual([]);
  });

  it('ranks a title-prefix match, then the rest of the title matches, then the summary ones', () => {
    const results = searchEntries(INDEX, 'cil');

    expect(results.map((result) => result.entryId)).toEqual([
      'trait:cilia',
      'trait:paramecium_cilia',
      'trait:cytoskeleton',
    ]);
    expect(results.map((result) => result.match)).toEqual([
      SEARCH_MATCH.titlePrefix,
      SEARCH_MATCH.title,
      SEARCH_MATCH.summary,
    ]);
  });

  // The list draws one header per category (§11.5) while a strong name match still has to lead the list, so results
  // are category-major with the categories ordered by the best match each holds. The two cases below reject the two
  // orderings that satisfy only one half of that: rank-major (which repeats a header) and plain rail order (which
  // buries the best match).
  describe('category order', () => {
    it('keeps a category contiguous, so a header is never drawn twice', () => {
      const index = [
        searchable('bacterium:aerobic', 'Ciliated bacterium', 'A swimmer.', ENTITIES),
        searchable('entity:dna_fragment', 'DNA fragment', 'Left where cilia swept.', ENTITIES),
        searchable('trait:paramecium_cilia', 'Paramecium Cilia', 'Dense rows.', EVOLUTIONS),
        searchable('trait:cilia', 'Cilia Fringe', 'Beating hairs.', EVOLUTIONS),
      ];

      const results = searchEntries(index, 'cil');

      // Rank-major would give bacterium, cilia, paramecium, dna_fragment — entities, evolutions, evolutions, entities.
      expect(results.map((result) => result.entryId)).toEqual([
        'bacterium:aerobic',
        'entity:dna_fragment',
        'trait:cilia',
        'trait:paramecium_cilia',
      ]);
      expect(groupSearchResults(results).map((group) => group.category)).toEqual([ENTITIES, EVOLUTIONS]);
    });

    it('leads with the category holding the best match, not the one the rail happens to put first', () => {
      const index = [
        searchable('entity:dna_fragment', 'DNA fragment', 'Left where cilia swept.', ENTITIES),
        searchable('trait:cilia', 'Cilia Fringe', 'Beating hairs.', EVOLUTIONS),
      ];

      const results = searchEntries(index, 'cil');

      // Plain rail order would leave the summary-only match above the title-prefix one.
      expect(results.map((result) => result.entryId)).toEqual(['trait:cilia', 'entity:dna_fragment']);
      expect(groupSearchResults(results).map((group) => group.category)).toEqual([EVOLUTIONS, ENTITIES]);
    });

    it('breaks a tie on the caller’s rail order', () => {
      const index = [
        searchable('bacterium:aerobic', 'Ciliated bacterium', 'A swimmer.', ENTITIES),
        searchable('trait:cilia', 'Cilia Fringe', 'Beating hairs.', EVOLUTIONS),
      ];

      expect(groupSearchResults(searchEntries(index, 'cil')).map((group) => group.category)).toEqual([
        ENTITIES,
        EVOLUTIONS,
      ]);
      expect(groupSearchResults(searchEntries([...index].reverse(), 'cil')).map((group) => group.category)).toEqual([
        EVOLUTIONS,
        ENTITIES,
      ]);
    });
  });

  describe('groupSearchResults', () => {
    it('cuts the results into sections without reordering them, and gives nothing for no results', () => {
      const groups = groupSearchResults(searchEntries(INDEX, 'cil'));

      expect(groups).toEqual([
        {
          category: EVOLUTIONS,
          results: searchEntries(INDEX, 'cil'),
        },
      ]);
      expect(groupSearchResults([])).toEqual([]);
    });

    it('gives one section per category even for an input whose categories are interleaved', () => {
      // `searchEntries` never produces this, but the signature accepts it, so the guarantee must not rest on the
      // caller: a category met again joins the section already open for it rather than opening a second one.
      const interleaved = [
        searchable('trait:cilia', 'Cilia Fringe', 'Beating hairs.', EVOLUTIONS),
        searchable('bacterium:aerobic', 'Ciliated bacterium', 'A swimmer.', ENTITIES),
        searchable('trait:paramecium_cilia', 'Paramecium Cilia', 'Dense rows.', EVOLUTIONS),
      ].map((entry) => ({
        entryId: entry.entryId,
        category: entry.category,
        title: entry.title,
        match: SEARCH_MATCH.title,
      }));

      const groups = groupSearchResults(interleaved);

      expect(groups.map((group) => group.category)).toEqual([EVOLUTIONS, ENTITIES]);
      expect(groups.map((group) => group.results.map((result) => result.entryId))).toEqual([
        ['trait:cilia', 'trait:paramecium_cilia'],
        ['bacterium:aerobic'],
      ]);
    });
  });

  it('ignores the case the player typed', () => {
    expect(searchEntries(INDEX, 'CILIA FR').map((result) => result.entryId)).toEqual(['trait:cilia']);
  });

  it('keeps the caller’s order inside one rank, which is rail order then list order', () => {
    const index = [
      searchable('trait:cilia', 'Cilia Fringe', 'A fringe of beating hairs.'),
      searchable('trait:cell_wall', 'Cilia Sheath', 'A sheath of hairs.'),
    ];

    expect(searchEntries(index, 'cilia').map((result) => result.entryId)).toEqual(['trait:cilia', 'trait:cell_wall']);
    expect(searchEntries([...index].reverse(), 'cilia').map((result) => result.entryId)).toEqual([
      'trait:cell_wall',
      'trait:cilia',
    ]);
  });

  it('reports an entry matching in both its title and its summary once, at the title rank', () => {
    const index = [searchable('trait:cilia', 'Cilia Fringe', 'The cilia beat in waves.')];
    const results = searchEntries(index, 'cilia');

    expect(results).toHaveLength(1);
    expect(results[0]?.match).toBe(SEARCH_MATCH.titlePrefix);
  });

  describe('accents', () => {
    // No entry in the registry carries an accent yet. Both directions are
    // pinned here so the folding cannot be quietly dropped before then.
    const accented: readonly SearchableEntry[] = [
      searchable('trait:paramecium_cilia', 'Paramécium Cilia', 'Dense rows that sweep food in.'),
      searchable('trait:cytoskeleton', 'Cytoskeleton Lattice', 'Stiffer than a paramécium’s rows.'),
    ];

    it('finds an accented title from a query typed without accents', () => {
      expect(searchEntries(accented, 'paramecium').map((result) => result.entryId)).toEqual([
        'trait:paramecium_cilia',
        'trait:cytoskeleton',
      ]);
    });

    it('finds a plain title and summary from a query typed with accents', () => {
      const plain = [searchable('trait:paramecium_cilia', 'Paramecium Cilia', 'Dense rows that sweep food in.')];

      expect(searchEntries(plain, 'Paramécium').map((result) => result.entryId)).toEqual(['trait:paramecium_cilia']);
    });

    it('matches an accented summary from a plain query', () => {
      expect(searchEntries(accented, 'paramecium’s').map((result) => result.entryId)).toEqual(['trait:cytoskeleton']);
    });
  });
});
