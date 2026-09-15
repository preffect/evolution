// The HUD's own numbers (docs/CODE-STANDARDS.md §2): the layout frame of docs/ui/layout.md §1 and the
// chrome sizes of §3.1.1, which that doc owns and this file declares exactly once. Colours and the
// type scale are docs/VISUAL-STYLE.md's and live in `render/constants`; gameplay numbers are the
// shared balance, reached through the live `game_state.balance` — nothing here is a copy of one.
//
// Only the constants the chrome (#185) needs are declared; #186–#190 add their own rows as they land.

// ---- layout frame (docs/ui/layout.md §1; the scale's reference viewport and bounds are the kit's, `ui-kit/ui-kit-constants.ts`) ----

/** Corner margin at scale 1: every chrome element anchors to its corner with this. */
export const HUD_MARGIN_PX = 16;

// ---- leaderboard (docs/ui/hud.md §3.1.1) ----

/** Compact panel width at scale 1. */
export const LEADERBOARD_WIDTH_PX = 240;
/** Full-list panel width at scale 1: the mass and absorptions columns need the extra 120 px. */
export const LEADERBOARD_FULL_WIDTH_PX = 360;
/** Header row height at scale 1 (`LEADERBOARD` + the `TAB` hint). */
export const LEADERBOARD_HEADER_HEIGHT_PX = 26;
/** One player row's height at scale 1. */
export const LEADERBOARD_ROW_HEIGHT_PX = 24;
/** The full list's column-label strip at scale 1; the compact panel has no numeric columns to name. */
export const LEADERBOARD_LABEL_ROW_HEIGHT_PX = 16;
/** Rows the compact panel shows; the own row replaces the last one when it is outside them. */
export const LEADERBOARD_COMPACT_ROWS = 5;
/** Rows the Tab-held full list shows. */
export const LEADERBOARD_FULL_ROWS = 8;
/** A name longer than this is cut and given an ellipsis, so the rendered string is never wider. */
export const LEADERBOARD_NAME_MAX_CHARS = 12;

// The row's column track widths at scale 1. Every track but the name is a **fixed** width, and the
// rows and the full list's label strip are laid out from the same numbers, so the two grids resolve
// identically whatever the content and a label always lands on the column it names (docs/UI.md
// §3.1.1). An `auto` track here would be sized by each grid's own content and they would drift.
/** The rank ordinal. */
export const LEADERBOARD_RANK_COLUMN_PX = 16;
/** The seat swatch's track; the swatch itself is `LEADERBOARD_SWATCH_DIAMETER_PX` inside it. */
export const LEADERBOARD_SWATCH_COLUMN_PX = 14;
/** The `L<n>` level column; wide enough for two digits. */
export const LEADERBOARD_LEVEL_COLUMN_PX = 30;
/** Each of score, mass and absorptions; wide enough for four digits and for its own label. */
export const LEADERBOARD_NUMBER_COLUMN_PX = 38;
/** Gap between columns. */
export const LEADERBOARD_COLUMN_GAP_PX = 6;
/** The panel's own left and right padding. */
export const LEADERBOARD_PADDING_PX = 8;
/** The panel's corner radius. */
export const LEADERBOARD_CORNER_RADIUS_PX = 4;

/** A row slides to its new rank over this, so a re-sort reads as movement and not as a jump. */
export const LEADERBOARD_ROW_SLIDE_MS = 200;
/** The panel's own widen/narrow when the full list opens; independent of the row re-sort above. */
export const LEADERBOARD_EXPAND_MS = 200;
/** The own row is tinted with the player's own rim colour at this alpha (docs/visual-style/ui-type.md §7). */
export const LEADERBOARD_OWN_ROW_TINT_ALPHA = 0.12;
/**
 * Diameter of the player swatch at scale 1 (docs/ui/hud.md §3.1.1 owns the value). Do not change this
 * or the bead below to make more seats countable: whether the swatch should grow for that is the
 * seat-identity question on #279, not a HUD-layout one.
 */
export const LEADERBOARD_SWATCH_DIAMETER_PX = 10;
/**
 * The seat-mark beads sit on the swatch's outline (docs/visual-style/principles-and-palette.md §2); this is their own
 * diameter at scale 1. Wider than the ring on purpose: a bead much narrower than this antialiases
 * into the rim and the non-colour tell stops being readable, which is its whole job.
 * `leaderboardSwatchGeometry` pins one user unit to one CSS px, so this size is what renders — if
 * a bead ever looks wrong on screen, check that pin before touching the value.
 */
export const LEADERBOARD_SWATCH_BEAD_DIAMETER_PX = 3;
/** The swatch's rim-colour ring width at scale 1. */
export const LEADERBOARD_SWATCH_RING_WIDTH_PX = 1.2;

// ---- own-cell status mirror (docs/ui/layout.md §1, docs/ui/hud.md §3.1.4) ----

/**
 * The mirror re-announces DNA only at multiples of this, so `aria-live` speaks a meaningful step
 * instead of every snapshot's percent (docs/ui/layout.md §1's table owns the value).
 */
export const STATUS_ANNOUNCE_DNA_STEP_PERCENT = 25;

// ---- round clock (docs/ui/hud.md §3.1.1) ----

/** Inside the last this many seconds the clock pulses once per second. */
export const ROUND_CLOCK_PULSE_LAST_SECONDS = 10;
/** One pulse per second. */
export const ROUND_CLOCK_PULSE_PERIOD_MS = 1000;

// ---- trait picker (docs/ui/layout.md §1, docs/ui/overlays.md §3.2) ----

/** Half-side of the exclusion box around the own cell at scale 1; also the picker dim's spotlight radius. */
export const HUD_PLAYER_EXCLUSION_PX = 120;
/** Gap between the exclusion box's bottom edge and the picker's title row. */
export const PICKER_BAND_GAP_PX = 16;
/** Gap between the picker's title row, timer bar and card row. */
export const PICKER_ROW_GAP_PX = 12;
/** The timer bar's width at scale 1; its height is `DNA_RING_STROKE_PX`, the width of every chrome fill bar. */
export const PICKER_TIMER_BAR_WIDTH_PX = 470;
/**
 * One card at scale 1. The height is the catalog's measured worst case in the 1280 × 800 band: Simple Flagellum
 * `II → III`, whose name wraps to three lines over three effect lines, is 214 px tall. Its key chip sits inside it.
 */
export const PICKER_CARD_WIDTH_PX = 170;
export const PICKER_CARD_HEIGHT_PX = 214;
/** Gap between two cards. */
export const PICKER_CARD_GAP_PX = 10;
/** The glyph medallion at the top of a card (its glyph is #312's; a category initial until then). */
export const PICKER_CARD_MEDALLION_PX = 56;
/** The highlighted card lifts this far. */
export const PICKER_CARD_LIFT_PX = 8;
/** The dim over the dish while an offer is open; the exclusion disc stays clear. */
export const PICKER_DIM_ALPHA = 0.55;
/**
 * Effect lines a card has room for: the catalog's longest tier row (the diatom shell's speed cost, the simple
 * flagellum's sprint cooldown). Lines are never cut; the spec fails the gate when a row outgrows this.
 */
export const PICKER_CARD_EFFECT_LINES_MAX = 3;
/** Where the dim's clear disc starts to fade, as a share of its radius: the soft edge. */
export const PICKER_DIM_SOFT_EDGE_FRACTION = 0.85;
/** Gap between a card's medallion, category, name, effect lines and rarity. */
export const PICKER_CARD_CONTENT_GAP_PX = 2;
/** A card's inner padding, top and bottom. */
export const PICKER_CARD_PADDING_BLOCK_PX = 8;
/** A card's inner padding, left and right. */
export const PICKER_CARD_PADDING_INLINE_PX = 8;
/** The highlighted card's accent glow. */
export const PICKER_CARD_GLOW_PX = 12;
/** How long a card takes to lift into, or settle out of, the highlight. */
export const PICKER_CARD_HIGHLIGHT_MS = 120;
/** The `RUNG` ribbon's padding either side of its word. */
export const PICKER_RIBBON_PADDING_INLINE_PX = 6;

// ---- notices (docs/ui/overlays.md §3.6, docs/ui/input-and-onboarding.md §6) ----

/** The connection banner and the server-error line under it: full width, this tall at scale 1. */
export const NOTICE_ROW_HEIGHT_PX = 32;
/** The notices stack down from the top of the viewport and never past this y at scale 1. */
export const NOTICE_STACK_MAX_Y_PX = 96;
/** While the socket is down the last snapshot stays on screen, dimmed by this much. */
export const CONNECTION_LOST_DIM_ALPHA = 0.2;
/** The notices' text inset from the viewport's left and right edges. */
export const NOTICE_PADDING_INLINE_PX = 16;
/** Gap between a notice's message and its dismiss control. */
export const NOTICE_GAP_PX = 16;
/** The rim under a notice row, in its tone's colour. */
export const NOTICE_RIM_PX = 2;

// ---- controls (docs/ui/input-and-onboarding.md §4) ----

/** Every interactive element's visible focus ring, in the text colour; never scaled. */
export const HUD_FOCUS_RING_PX = 2;
