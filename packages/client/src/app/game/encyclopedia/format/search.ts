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

/** The ranks in the order results are listed in (§11.5). */
const SEARCH_MATCH_RANKS: readonly SearchMatch[] = [SEARCH_MATCH.titlePrefix, SEARCH_MATCH.title, SEARCH_MATCH.summary];

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

/** The form a query and a searched text are both compared in: decomposed, stripped of accents, lowercased. */
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

function rankIndexOf(match: SearchMatch): number {
  return SEARCH_MATCH_RANKS.indexOf(match);
}

/** The best rank any of `category`'s matches achieved; 0 is a title-prefix match. */
function bestRankIn(matched: readonly EncyclopediaSearchResult[], category: EncyclopediaCategory): number {
  const ranks = matched.filter((result) => result.category === category).map((result) => rankIndexOf(result.match));
  return Math.min(...ranks);
}

/**
 * The categories present, best match first. The tie-break is the caller's own order — the rail's — taken from where
 * each category's first match sits, so the ordering never leans on the sort being stable.
 */
function categoriesByBestMatch(matched: readonly EncyclopediaSearchResult[]): readonly EncyclopediaCategory[] {
  const ordered = [...new Set(matched.map((result) => result.category))].map((category, firstIndex) => ({
    category,
    firstIndex,
    bestRank: bestRankIn(matched, category),
  }));
  ordered.sort((one, other) => one.bestRank - other.bestRank || one.firstIndex - other.firstIndex);
  return ordered.map((ranked) => ranked.category);
}

/**
 * The entries `query` matches, category-major and ranked (§11.5). A blank query matches nothing — the list column
 * shows its category's entries instead — and Enter opens the first result, so the head of this array is the one the
 * player expects: the best match in the category that holds it.
 */
export function searchEntries(index: readonly SearchableEntry[], query: string): readonly EncyclopediaSearchResult[] {
  const foldedQuery = foldForSearch(query.trim());
  if (foldedQuery.length === 0) return [];
  const matched = index.flatMap((entry) => {
    const match = matchOf(entry, foldedQuery);
    if (match === null) return [];
    return [{ entryId: entry.entryId, category: entry.category, title: entry.title, match }];
  });
  return categoriesByBestMatch(matched).flatMap((category) => {
    const inCategory = matched.filter((result) => result.category === category);
    return SEARCH_MATCH_RANKS.flatMap((rank) => inCategory.filter((result) => result.match === rank));
  });
}

/**
 * The ranked results cut into the sections the list draws. Because `searchEntries` keeps a category's matches
 * contiguous, each category appears exactly once — the grouping cannot reorder anything, only split it.
 */
export function groupSearchResults(results: readonly EncyclopediaSearchResult[]): readonly EncyclopediaSearchGroup[] {
  const groups: { category: EncyclopediaCategory; results: EncyclopediaSearchResult[] }[] = [];
  for (const result of results) {
    const open = groups.at(-1);
    if (open?.category === result.category) open.results.push(result);
    else groups.push({ category: result.category, results: [result] });
  }
  return groups;
}
