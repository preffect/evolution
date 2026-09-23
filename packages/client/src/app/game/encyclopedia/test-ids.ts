// The one home of every encyclopedia `data-testid` (docs/ui/encyclopedia.md §11.6): the panel renders these values,
// the input layer's modal gate queries the panel id (§4) and the Playwright loop asserts on them, so no id literal is
// typed twice. Keys are camelCase, values the id strings §11.6 names.
//
// A leaf file: it imports nothing but shared types, so `input/input-constants.ts` can take the panel id from it
// without dragging the encyclopedia in. Ids are built from `EntryId`s, which §12.2 keeps `:`- and `#`-safe for an
// attribute selector.

import type { TraitTier } from '@evolution/shared';
import type { EncyclopediaCategory } from './model/categories';
import type { EntryId } from './model/entry-id';

export const ENCYCLOPEDIA_TEST_ID = {
  /** The panel itself, with `data-location="<category>|<entryId>"`. */
  encyclopedia: 'encyclopedia',
  /** The header's Back control (docs/ui/encyclopedia.md §11.5). */
  back: 'encyclopedia-back',
  /** The header's Close control, which returns to wherever the panel was opened from (§11.1). */
  close: 'encyclopedia-close',
  /** The search field (§11.5). */
  search: 'encyclopedia-search',
  /** The `No match for "xyz"` line the list shows when a query matches nothing. */
  noResults: 'encyclopedia-no-results',
  /** The header's alert strip, with `data-alert-kind` (§11.1); projected by the host, absent in the lobby. */
  alert: 'encyclopedia-alert',
  /** The category rail. */
  rail: 'encyclopedia-rail',
  /** The entry list, or the search results under their category headers. */
  list: 'encyclopedia-list',
  /** The entry page, with `data-entry-id`. */
  entry: 'encyclopedia-entry',
  /** The live preview lens, with `data-preview-state` (§11.4). */
  preview: 'encyclopedia-preview',
  /** The lens's replay control, on the entries whose preview is an action scene. */
  previewReplay: 'encyclopedia-preview-replay',
  /** The sticky title bar a scrolled entry shows at the column's top edge (§11.4); absent while the title is in view. */
  stickyTitle: 'encyclopedia-sticky-title',
  /** The entry's facts table. */
  facts: 'encyclopedia-facts',
  /** The lobby header's button that opens the panel outside a room (docs/ui/encyclopedia.md §11.1). */
  lobbyButton: 'lobby-encyclopedia',
} as const;

/** One category's rail row. */
export function encyclopediaCategoryTestId(category: EncyclopediaCategory): string {
  return `encyclopedia-category-${category}`;
}

/** One list row, by the entry it names. */
export function encyclopediaRowTestId(entryId: EntryId): string {
  return `encyclopedia-row-${entryId}`;
}

/**
 * One breadcrumb crumb that goes somewhere, by the category it goes to (§11.6). `encyclopediaLinkTestId` names a link
 * to an *entry*; a crumb targets a category, and #449 has to put it in the detail column's Tab order.
 */
export function encyclopediaCrumbTestId(category: EncyclopediaCategory): string {
  return `encyclopedia-crumb-${category}`;
}

/** One landing tile, by the entry it names. */
export function encyclopediaTileTestId(entryId: EntryId): string {
  return `encyclopedia-tile-${entryId}`;
}

/** One tier section of a trait's page (§11.4). */
export function encyclopediaTierTestId(tier: TraitTier): string {
  return `encyclopedia-tier-${tier}`;
}

/** Every link to an entry carries this, wherever it sits — prose, facts, chips, breadcrumbs; a test takes the first. */
export function encyclopediaLinkTestId(entryId: EntryId): string {
  return `encyclopedia-link-${entryId}`;
}
