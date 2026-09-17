// The encyclopedia's own numbers (docs/CODE-STANDARDS.md §2): the values docs/ui/encyclopedia.md §11.7 owns, declared
// exactly once here. Ids live in `test-ids.ts`, category labels and order in `model/categories.ts` (§11.2), and every
// gameplay number is the shared balance read through `EncyclopediaContextService` — nothing here is a copy of one.
//
// The core's (#447) constants and the panel's (#448) layout row are declared; the entry page (#373) adds the lens's
// and the keyboard (#449) its key codes as those slices land.

import { ENCYCLOPEDIA_CATEGORY, type EncyclopediaCategory } from './model/categories';

/** Back-stack depth (docs/ui/encyclopedia.md §11.7); the oldest location drops first. */
export const ENCYCLOPEDIA_HISTORY_MAX = 50;

/** The panel's distance from every viewport edge (docs/ui/encyclopedia.md §11.7). */
export const ENCYCLOPEDIA_INSET_PX = 32;

/** The panel's widest and tallest; the inset holds both sides below them. */
export const ENCYCLOPEDIA_MAX_WIDTH_PX = 1360;
export const ENCYCLOPEDIA_MAX_HEIGHT_PX = 880;

/** The header row, over a 1 px panel-rim rule; it never scrolls. */
export const ENCYCLOPEDIA_HEADER_HEIGHT_PX = 56;

/** The category rail: the longest label, `Cells & food`, with its icon and a two-digit count. */
export const ENCYCLOPEDIA_RAIL_WIDTH_PX = 184;

/** The entry list: `Photosynthetic bacterium` and `Cytoskeleton Lattice` fit beside their medallion. */
export const ENCYCLOPEDIA_LIST_WIDTH_PX = 280;

/** A landing tile, and the well it leads with (docs/ui/encyclopedia.md §11.3). */
export const ENCYCLOPEDIA_TILE_WIDTH_PX = 168;
export const ENCYCLOPEDIA_TILE_HEIGHT_PX = 132;
export const ENCYCLOPEDIA_TILE_PREVIEW_HEIGHT_PX = 96;

/** The callout-backing scrim behind the panel in a round. */
export const ENCYCLOPEDIA_SCRIM_ALPHA = 0.8;

/** The panel's own name, on the header and as the dialog's accessible name and first breadcrumb. */
export const ENCYCLOPEDIA_TITLE = 'Encyclopedia';

/** The rail icon's square, drawn in `currentColor` so a selected item's icon takes the accent (§11.3). */
export const ENCYCLOPEDIA_RAIL_ICON_PX = 16;

/** The search field's placeholder, which also names it for a screen reader. */
export const ENCYCLOPEDIA_SEARCH_PLACEHOLDER = 'Search';

/** The list header while a search is running, where no one category is selected (§11.5). */
export const ENCYCLOPEDIA_RESULTS_LABEL = 'Results';

/** `No match for "xyz"` (§11.5), around the query as typed. */
export const ENCYCLOPEDIA_NO_MATCH_PREFIX = 'No match for "';
export const ENCYCLOPEDIA_NO_MATCH_SUFFIX = '"';

/**
 * Where an open with nothing else asked for starts (docs/ui/encyclopedia.md §11.1): the rules every other page leans
 * on. While that category has no entry yet (#361), §11.5's empty-category rule sends the open to the first category
 * that does.
 */
export const DEFAULT_ENCYCLOPEDIA_CATEGORY: EncyclopediaCategory = ENCYCLOPEDIA_CATEGORY.basics;
