// The encyclopedia's search, pure (docs/ui/encyclopedia.md §11.5): a typed query to the entries it matches, ranked.
//
// Matching is case- **and accent-insensitive** in both directions: a query typed without accents finds an accented
// title, and a query typed with them finds it too, because query and text are compared in the same folded form. The
// resolved title is matched first — a title-prefix match ahead of any other title match — and the summary text last;
// inside each rank the caller's order is kept, which is the rail's category order, each category in list order.

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

/**
 * The entries `query` matches, ranked (§11.5). A blank query matches nothing — the list column shows its category's
 * entries instead — and Enter opens the first result, so the head of this array is the one the player expects.
 */
export function searchEntries(index: readonly SearchableEntry[], query: string): readonly EncyclopediaSearchResult[] {
  const foldedQuery = foldForSearch(query.trim());
  if (foldedQuery.length === 0) return [];
  const matched = index.flatMap((entry) => {
    const match = matchOf(entry, foldedQuery);
    if (match === null) return [];
    return [{ entryId: entry.entryId, category: entry.category, title: entry.title, match }];
  });
  return SEARCH_MATCH_RANKS.flatMap((rank) => matched.filter((result) => result.match === rank));
}
