// The list column's view model, pure (docs/ui/encyclopedia.md §11.3 and §11.5): the same shape whether the column is
// showing a category's groups or a search's results, so the template draws rows once instead of twice.
//
// The two differ in exactly one rule. A category shows group headers **only when it has more than one group**
// (§11.2), because a single header names what the column header already says. A search always shows a header per
// category, since a result list mixes categories and §11.5 requires each one's header drawn exactly once — which
// `groupSearchResults` guarantees by construction, for any input.

import {
  ENCYCLOPEDIA_NO_MATCH_PREFIX,
  ENCYCLOPEDIA_NO_MATCH_SUFFIX,
  ENCYCLOPEDIA_RESULTS_LABEL,
} from '../encyclopedia-constants';
import { ENCYCLOPEDIA_CATEGORY_LABEL, type EncyclopediaCategory } from '../model/categories';
import type { EntryLink, ResolvedGroup } from '../model/entry';
import type { EntryId } from '../model/entry-id';
import { ENTRY_GROUP_LABEL } from '../model/groups';
import type { EncyclopediaSearchGroup, EncyclopediaSearchResult } from './search';

/** One run of rows, under a header or, with `heading` null, under none. */
export interface EncyclopediaListSection {
  /** Stable across a re-render, so `@for` keeps its rows: the group id, or the category of a result run. */
  readonly key: string;
  readonly heading: string | null;
  readonly entries: readonly EntryLink[];
}

/** The line over the list: what the column is showing, and how many rows it holds. */
export interface EncyclopediaListHeader {
  readonly label: string;
  readonly count: number;
}

/** How many entries a category holds, across every one of its groups. */
export function entryCountIn(groups: readonly ResolvedGroup[]): number {
  return groups.reduce((total, group) => total + group.entries.length, 0);
}

/**
 * A category's groups as sections. A group with no id (an ungrouped category, §11.2) and a category with one group
 * both draw their rows bare: the header would only repeat the column header above it.
 */
export function categoryListSections(groups: readonly ResolvedGroup[]): readonly EncyclopediaListSection[] {
  const shouldShowHeadings = groups.length > 1;
  return groups.map((group, index) => ({
    key: group.group ?? String(index),
    heading: shouldShowHeadings && group.group !== null ? ENTRY_GROUP_LABEL[group.group] : null,
    entries: group.entries,
  }));
}

/** The search's category runs as sections, each under its category's label (§11.5). */
export function searchListSections(groups: readonly EncyclopediaSearchGroup[]): readonly EncyclopediaListSection[] {
  return groups.map((group) => ({
    key: group.category,
    heading: ENCYCLOPEDIA_CATEGORY_LABEL[group.category],
    entries: group.results.map((result) => ({ entryId: result.entryId, title: result.title })),
  }));
}

export function categoryListHeader(
  category: EncyclopediaCategory,
  groups: readonly ResolvedGroup[],
): EncyclopediaListHeader {
  return { label: ENCYCLOPEDIA_CATEGORY_LABEL[category], count: entryCountIn(groups) };
}

/** The header while a query is running: no one category is selected, so the column says what it is showing. */
export function searchListHeader(results: readonly EncyclopediaSearchResult[]): EncyclopediaListHeader {
  return { label: ENCYCLOPEDIA_RESULTS_LABEL, count: results.length };
}

/**
 * The entry a list row's `itemId` names, or `null` for anything the column is not currently showing. The kit hands
 * its selection back as the opaque string the feature put in, so it is narrowed against the drawn sections rather
 * than cast: a stale id from a list that has just been replaced moves the reader nowhere.
 */
export function entryIdFromItemId(itemId: string | null, sections: readonly EncyclopediaListSection[]): EntryId | null {
  for (const section of sections) {
    const match = section.entries.find((entry) => entry.entryId === itemId);
    if (match !== undefined) return match.entryId;
  }
  return null;
}

/** `No match for "xyz"` (§11.5), around the query exactly as it was typed, spaces and all. */
export function noMatchTextFor(query: string): string {
  return `${ENCYCLOPEDIA_NO_MATCH_PREFIX}${query}${ENCYCLOPEDIA_NO_MATCH_SUFFIX}`;
}
