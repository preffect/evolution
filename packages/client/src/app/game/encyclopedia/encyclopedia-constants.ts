// The encyclopedia's own numbers (docs/CODE-STANDARDS.md §2): the values docs/ui/encyclopedia.md §11.7 owns, declared
// exactly once here. Ids live in `test-ids.ts`, category labels and order in `model/categories.ts` (§11.2), and every
// gameplay number is the shared balance read through `EncyclopediaContextService` — nothing here is a copy of one.
//
// The core's (#447) constants, the panel's (#448) layout row, the keyboard's (#449) key codes, the entry page's
// (#465) and the lens's (#466) are declared.

import { PREVIEW_SCENE, type PreviewActionScene } from '../render/preview/preview-spec';
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

/**
 * The entry page's content column (docs/ui/encyclopedia.md §11.4). The panel's own width cap already holds the detail
 * column to this, so the cap never bites today; it is declared because the column is the page's measure and a later
 * wider panel must not stretch it.
 */
export const ENCYCLOPEDIA_CONTENT_MAX_WIDTH_PX = 848;

/**
 * The lens, and the side of its square preview canvas (§11.4).
 *
 * **It is at its ceiling.** `render/constants/preview.ts` clamps each canvas side to `PREVIEW_CANVAS_MAX_PX` 900
 * **device** pixels, and this diameter is multiplied by the kit's `UI_SCALE_MAX` and then by the preview's own DPR
 * cap before it gets there: 300 × 1.5 × 2 is exactly 900, with nothing to spare. Raising any of the three without
 * raising the clamp makes the canvas shrink under a lens that did not, and `encyclopedia-lens.spec.ts` fails on the
 * product rather than letting it happen quietly.
 */
export const ENCYCLOPEDIA_LENS_DIAMETER_PX = 300;

/** The lens to the title column. */
export const ENCYCLOPEDIA_LENS_GAP_PX = 32;

/** The lens rim, in `PANEL_RIM`; the eyepiece wears it whether or not a scene is under it. */
export const ENCYCLOPEDIA_LENS_RIM_PX = 6;

/**
 * The 1 px `LIGHT_ACCENT` ring inside the rim — the condenser's bright edge (§11.4). It is the eyepiece's own
 * furniture rather than the preview's, which is why the box wore it while it was empty: without it the box was a bare
 * outline of a circle, which is what a failed image looks like (PR #471's review measured the well at one unit per
 * channel over the panel behind it).
 */
export const ENCYCLOPEDIA_LENS_INNER_RING_ALPHA = 0.35;

/** The radial edge vignette, the eyepiece's field stop: `CALLOUT_BACKING` from this fraction of the radius... */
export const ENCYCLOPEDIA_LENS_VIGNETTE_START_FRACTION = 0.7;

/** ...to this alpha at the rim (§11.4). */
export const ENCYCLOPEDIA_LENS_VIGNETTE_ALPHA = 0.6;

/** Reticle ticks around the lens, inward from the rim (§11.4). */
export const ENCYCLOPEDIA_LENS_TICK_COUNT = 24;

/** Every sixth tick is a major one, which puts the four long ones on the quarters. */
export const ENCYCLOPEDIA_LENS_MAJOR_TICK_EVERY = 6;

/** Tick lengths, inward from the rim's inner edge; no tick reaches into the rim or past the safe circle. */
export const ENCYCLOPEDIA_LENS_MAJOR_TICK_PX = 10;
export const ENCYCLOPEDIA_LENS_MINOR_TICK_PX = 5;

/** The ticks' opacity, in the label colour. */
export const ENCYCLOPEDIA_LENS_TICK_ALPHA = 0.6;

/** The widest line of the `unavailable` text inside the lens, as a fraction of the diameter (§11.4). */
export const ENCYCLOPEDIA_LENS_TEXT_WIDTH_FRACTION = 0.7;

/**
 * The `loading` state's one ring, as a fraction of the lens **radius** — §11.4's "half the radius". It pulses
 * rather than spinning: the lens is an eyepiece focusing, not a spinner, and a ring at half the radius is clear of
 * both the reticle and the text the `unavailable` state puts in the same place.
 */
export const ENCYCLOPEDIA_LENS_LOADING_RING_RADIUS_FRACTION = 0.5;

/** One breath of that ring. Slow on purpose: §12.7 budgets the open at 300 ms, so this is a wait, not a progress bar. */
export const ENCYCLOPEDIA_LENS_LOADING_PULSE_MS = 1800;

/** The dimmest the pulse goes; it breathes back to full. Under `prefers-reduced-motion` the ring simply holds full. */
export const ENCYCLOPEDIA_LENS_LOADING_PULSE_MIN_ALPHA = 0.2;

/**
 * Arrowing through the list calls `show` only once the selection has rested this long (§11.4). `show` swaps a scene
 * without baking anything, so this is not a cost guard: it is so that holding ↓ through a category does not restart
 * a scene per row, which reads as a flicker rather than as previews.
 */
export const ENCYCLOPEDIA_PREVIEW_SETTLE_MS = 150;

/**
 * The replay button's label under an action scene (§11.4), keyed by the scenes that play an action through: a record,
 * so a new action scene without a label fails `typecheck`. One value in build 1.
 */
export const ENCYCLOPEDIA_PREVIEW_REPLAY_LABEL: Readonly<Record<PreviewActionScene, string>> = {
  [PREVIEW_SCENE.eat]: 'Replay',
  [PREVIEW_SCENE.engulf]: 'Replay',
  [PREVIEW_SCENE.escape]: 'Replay',
  [PREVIEW_SCENE.sprint]: 'Replay',
  [PREVIEW_SCENE.levelUp]: 'Replay',
};

/** The `unavailable` state's line, inside the circle: the preview app could not start, and there is no retry. */
export const ENCYCLOPEDIA_PREVIEW_UNAVAILABLE_TEXT = 'Preview unavailable';

/** The prose measure: about 90 characters of `body` (§11.4). */
export const ENCYCLOPEDIA_PROSE_MAX_WIDTH_PX = 640;

/**
 * A landing tile, and the well it leads with (docs/ui/encyclopedia.md §11.3). The height holds the well, the one-line
 * title and a fact of up to `ENCYCLOPEDIA_TILE_FACT_LINES` lines: a fact reads `<name>: <value>`, and at one line
 * the name spent the characters the value needed, cutting 30 of 78 tiles mid-value (#462).
 */
export const ENCYCLOPEDIA_TILE_WIDTH_PX = 168;
export const ENCYCLOPEDIA_TILE_HEIGHT_PX = 152;
export const ENCYCLOPEDIA_TILE_PREVIEW_HEIGHT_PX = 96;
/** The lines a tile's fact may wrap to before it ends in an ellipsis, and the line height it wraps at. */
export const ENCYCLOPEDIA_TILE_FACT_LINES = 2;
export const ENCYCLOPEDIA_TILE_FACT_LINE_HEIGHT = 1.2;

/** The callout-backing scrim behind the panel in a round: the dish keeps running, faintly, under it. */
export const ENCYCLOPEDIA_SCRIM_ALPHA = 0.8;

/**
 * The same scrim outside a round (docs/ui/encyclopedia.md §11.7). There is no dish to keep behind the panel there,
 * only the lobby's own chrome, and a header half-legible in the 32 px band above the panel reads as a bug rather
 * than as depth — so the lobby's scrim covers completely.
 */
export const ENCYCLOPEDIA_LOBBY_SCRIM_ALPHA = 1;

/** The panel's own name, on the header and as the dialog's accessible name and first breadcrumb. */
export const ENCYCLOPEDIA_TITLE = 'Encyclopedia';

/** The rail icon's square, drawn in `currentColor` so a selected item's icon takes the accent (§11.3). */
export const ENCYCLOPEDIA_RAIL_ICON_PX = 16;

/** The search field's placeholder, which also names it for a screen reader. */
export const ENCYCLOPEDIA_SEARCH_PLACEHOLDER = 'Search';

/**
 * The entry page's own words (docs/ui/encyclopedia.md §11.4). Each facts table sits under a `label` header: a trait
 * gets both of the first two, and every other entry the third — §11.4 names a header only for the trait's two, and an
 * entry whose one table sat under no header at all read as a stray list of values.
 */
export const ENCYCLOPEDIA_EFFECTS_TABLE_LABEL = 'Effects by tier';
export const ENCYCLOPEDIA_LADDER_TABLE_LABEL = 'Unlock and ladder';
export const ENCYCLOPEDIA_FACTS_TABLE_LABEL = 'Facts';

/** The See also header, over the link chips (§11.4). */
export const ENCYCLOPEDIA_SEE_ALSO_LABEL = 'See also';

/** `You own II`: the caption over the noun column of the Effects by tier table, before the owned tier's numeral. */
export const ENCYCLOPEDIA_TIER_CAPTION_PREFIX = 'You own ';

/** `OWNED · II`: the level-gold chip a round adds, before and between the word and the tier's numeral. */
export const ENCYCLOPEDIA_OWNED_CHIP_LABEL = 'OWNED';
export const ENCYCLOPEDIA_OWNED_CHIP_SEPARATOR = ' · ';

/** What a tier column shows where that tier leaves the row's modifier at identity (§11.4). */
export const ENCYCLOPEDIA_TIER_IDENTITY_TEXT = '—';

/** The list header while a search is running, where no one category is selected (§11.5). */
export const ENCYCLOPEDIA_RESULTS_LABEL = 'Results';

/** `No match for "xyz"` (§11.5), around the query as typed. */
export const ENCYCLOPEDIA_NO_MATCH_PREFIX = 'No match for "';
export const ENCYCLOPEDIA_NO_MATCH_SUFFIX = '"';

/**
 * Where an open with nothing else asked for starts (docs/ui/encyclopedia.md §11.1): the rules every other page leans
 * on. Should that category ever have no entry, §11.5's empty-category rule sends the open to the first category
 * that does.
 */
export const DEFAULT_ENCYCLOPEDIA_CATEGORY: EncyclopediaCategory = ENCYCLOPEDIA_CATEGORY.basics;

/**
 * Focuses the search field from anywhere in the encyclopedia but a text field (docs/ui/encyclopedia.md §11.5). A
 * `KeyboardEvent.code`, like every other key here, so a layout that puts `/` behind a modifier still reaches it.
 * The lobby reads these as well as the room, which is why they live here and not in `input/input-constants.ts`.
 */
export const ENCYCLOPEDIA_SEARCH_KEY_CODE = 'Slash';

/**
 * One key plus its modifiers, as `KeyboardEvent` reports them; an omitted modifier must be up. The modifier is
 * `isAltKeyHeld` rather than `KeyboardEvent`'s own `altKey`, which this repository's boolean-naming rule forbids;
 * §11.7's table is written the same way.
 */
export interface EncyclopediaKeyChord {
  readonly code: string;
  readonly isAltKeyHeld?: boolean;
}

/**
 * Back (docs/ui/encyclopedia.md §11.5, §11.7): `Alt+←` anywhere, and Backspace outside a text field — where it is
 * the delete key and the search field must keep it. It goes back one *move*, never one entry out of a category, and
 * it is never the close.
 */
export const ENCYCLOPEDIA_BACK_KEYS: readonly EncyclopediaKeyChord[] = [
  { code: 'ArrowLeft', isAltKeyHeld: true },
  { code: 'Backspace' },
];
