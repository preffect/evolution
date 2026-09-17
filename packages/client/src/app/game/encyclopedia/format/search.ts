// The encyclopedia's search, pure (docs/ui/encyclopedia.md §11.5): a typed query to the entries it matches, ranked.
//
// Matching is case- **and accent-insensitive** in both directions: a query typed without accents finds an accented
// title, and a query typed with them finds it too, because query and text are compared in the same folded form. The
// resolved title is matched first — a title-prefix match ahead of any other title match — and the summary text last.
//
// Results are **category-major**: every match of one category is contiguous, so the list draws that category's header
// exactly once, and the categories run in the order of the best match each one holds. That keeps both halves of §11.5:
// a strong name match still leads the list, and no header is ever repeated. Inside a category, entries run by match
// rank and then by the caller's own list order. A tie between two categories keeps the caller's rail order.

import type { ValueOf } from '@evolution/shared';
import type { EncyclopediaCategory } from '../model/categories';
import type { ProseSegment } from '../model/entry';
import type { EntryId } from '../model/entry-id';

export const SEARCH_MATCH = {
  /** The query starts the title: `cil` for `Cilia Fringe`. */
  titlePrefix: 'title_prefix',
  /** The query is elsewhere in the title: `cil` for `Paramecium Cilia`. */
  title: 'title',
  /** The query is only in the summary. */
  summary: 'summary',
} as const;
export type SearchMatch = ValueOf<typeof SEARCH_MATCH>;

/**
 * What each kind of match is worth, lowest first (§11.5). A total record over the closed set rather than an array of
 * it, so a `SEARCH_MATCH` member added later is a compile error here instead of a match that is silently dropped from
 * the results and sorts its category to the front on an `indexOf` miss.
 */
const TITLE_PREFIX_RANK = 0;
const TITLE_RANK = TITLE_PREFIX_RANK + 1;
const SUMMARY_RANK = TITLE_RANK + 1;

const SEARCH_MATCH_RANK: Readonly<Record<SearchMatch, number>> = {
  [SEARCH_MATCH.titlePrefix]: TITLE_PREFIX_RANK,
  [SEARCH_MATCH.title]: TITLE_RANK,
  [SEARCH_MATCH.summary]: SUMMARY_RANK,
};

/** One entry as search sees it: what a caller resolved, in the order it wants matches listed. */
export interface SearchableEntry {
  readonly entryId: EntryId;
  readonly category: EncyclopediaCategory;
  readonly title: string;
  /** The resolved summary flattened by `proseText`; a value or a link reads as the words on screen. */
  readonly summaryText: string;
}

export interface EncyclopediaSearchResult {
  readonly entryId: EntryId;
  readonly category: EncyclopediaCategory;
  readonly title: string;
  readonly match: SearchMatch;
}

/** One category's section of the results, which the list draws under a single header. */
export interface EncyclopediaSearchGroup {
  readonly category: EncyclopediaCategory;
  readonly results: readonly EncyclopediaSearchResult[];
}

/** The combining marks NFD splits an accented letter into; dropping them leaves the plain letter. */
const COMBINING_MARKS = /\p{Mn}/gu;

/**
 * The form a query and a searched text are both compared in: decomposed, stripped of accents, lowercased.
 *
 * Deliberately limited to what NFD decomposes. Ligatures and stroked letters — `œ`, `æ`, `ß`, `ø` — have no combining
 * mark to drop, so they stay as typed and `oeil` will not find `Œil`. None appears in an entry title, and the fix is a
 * transliteration table rather than a regex, so it is out of scope until one does.
 *
 * `\p{Mn}` (nonspacing marks) rather than `\p{Diacritic}`, which is the right class for NFD output; the dev-only kit
 * sample sheet (`ui-kit/kit-states/kit-collections.component.ts`) folds with `\p{Diacritic}`. The two are independent
 * on purpose — neither should be "fixed" to match the other.
 */
export function foldForSearch(text: string): string {
  return text.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}

/** Resolved prose as the plain text it reads as on screen: a value segment is its formatted number, a link its title. */
export function proseText(segments: readonly ProseSegment[]): string {
  return segments.map((segment) => segment.text).join('');
}

function matchOf(entry: SearchableEntry, foldedQuery: string): SearchMatch | null {
  const title = foldForSearch(entry.title);
  if (title.startsWith(foldedQuery)) return SEARCH_MATCH.titlePrefix;
  if (title.includes(foldedQuery)) return SEARCH_MATCH.title;
  if (foldForSearch(entry.summaryText).includes(foldedQuery)) return SEARCH_MATCH.summary;
  return null;
}

/** A match with the two numbers that order it: what it is worth, and where the caller put it. */
interface RankedMatch {
  readonly result: EncyclopediaSearchResult;
  readonly rank: number;
  /** Position among the matches, in the caller's own rail-and-list order. */
  readonly order: number;
}

function rankedMatches(index: readonly SearchableEntry[], foldedQuery: string): readonly RankedMatch[] {
  const ranked: RankedMatch[] = [];
  for (const entry of index) {
    const match = matchOf(entry, foldedQuery);
    if (match === null) continue;
    const result = { entryId: entry.entryId, category: entry.category, title: entry.title, match };
    ranked.push({ result, rank: SEARCH_MATCH_RANK[match], order: ranked.length });
  }
  return ranked;
}

/**
 * The categories present, best match first, ties broken on `railIndex` — where the category's first match sits in the
 * caller's order, which is rail order. Because `railIndex` is distinct per category the comparator is a total order,
 * so the result never leans on `Array.sort` being stable. No test in this runtime can show that (V8's sort has been
 * stable since ES2019), so do not delete the tie-break on the strength of a green run: it holds by reading.
 */
function categoriesByBestMatch(ranked: readonly RankedMatch[]): readonly EncyclopediaCategory[] {
  const ordered = [...new Set(ranked.map((match) => match.result.category))].map((category, railIndex) => ({
    category,
    railIndex,
    bestRank: Math.min(...ranked.filter((match) => match.result.category === category).map((match) => match.rank)),
  }));
  ordered.sort((one, other) => one.bestRank - other.bestRank || one.railIndex - other.railIndex);
  return ordered.map((entry) => entry.category);
}

/**
 * The entries `query` matches, category-major and ranked (§11.5). A blank query matches nothing — the list column
 * shows its category's entries instead — and Enter opens the first result, so the head of this array is the one the
 * player expects: the best match in the category that holds it.
 */
export function searchEntries(index: readonly SearchableEntry[], query: string): readonly EncyclopediaSearchResult[] {
  const foldedQuery = foldForSearch(query.trim());
  if (foldedQuery.length === 0) return [];
  const ranked = rankedMatches(index, foldedQuery);
  return categoriesByBestMatch(ranked).flatMap((category) =>
    ranked
      .filter((match) => match.result.category === category)
      .sort((one, other) => one.rank - other.rank || one.order - other.order)
      .map((match) => match.result),
  );
}

/**
 * The results cut into the sections the list draws, one per category, the categories in the order they first appear.
 * It holds for any input, not only for `searchEntries`' contiguous output: a category met again is added to the
 * section already open for it, so no category can ever be given two headers.
 */
export function groupSearchResults(results: readonly EncyclopediaSearchResult[]): readonly EncyclopediaSearchGroup[] {
  const byCategory = new Map<EncyclopediaCategory, EncyclopediaSearchResult[]>();
  for (const result of results) {
    const open = byCategory.get(result.category);
    if (open === undefined) byCategory.set(result.category, [result]);
    else open.push(result);
  }
  return [...byCategory].map(([category, grouped]) => ({ category, results: grouped }));
}
