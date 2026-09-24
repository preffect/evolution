// The HUD's own numbers (docs/CODE-STANDARDS.md §2): the layout frame of docs/ui/layout.md §1 and the
// chrome sizes of §3.1.1, which that doc owns and this file declares exactly once. Colours and the
// type scale are docs/VISUAL-STYLE.md's and live in `render/constants`; gameplay numbers are the
// shared balance, reached through the live `game_state.balance` — nothing here is a copy of one.
//
// Only the constants the chrome (#185) needs are declared; #186–#190 add their own rows as they land.

import { TRAIT_GLYPH_CARD_PX } from '../glyphs/glyph-constants';

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
/** The column-label strip under the header at scale 1, on both panels (decision #324). */
export const LEADERBOARD_LABEL_ROW_HEIGHT_PX = 16;
/** The full list's score-rule footer row at scale 1 (docs/ui/layout.md §1's table owns the value). */
export const LEADERBOARD_FOOTER_ROW_HEIGHT_PX = 24;
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
/** The score track: five `figure` digits and its `SCORE` label, 42 px, both fit. */
export const LEADERBOARD_SCORE_COLUMN_PX = 44;
/** The mass track: four `figure` digits and its `MASS` label, about 34 px each. */
export const LEADERBOARD_MASS_COLUMN_PX = 38;
/** The engulf count's track: its `ENGULFS` label, 57 px, is the widest in the strip (decision #324). */
export const LEADERBOARD_ENGULFS_COLUMN_PX = 58;
/**
 * The least the full list's name track may be at scale 1: a wide 12-character name in `body`
 * (`BigHungryAmo`, 105 px in Inter), so a name reaches its character cut before the column cuts it.
 */
export const LEADERBOARD_NAME_COLUMN_MIN_PX = 105;
/** The panel's rim and its header and footer rules. */
export const LEADERBOARD_RIM_PX = 1;
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

/** Half-side of the exclusion box around the own cell at scale 1; also the floor of the picker dim's spotlight radius. */
export const HUD_PLAYER_EXCLUSION_PX = 120;
/** Gap between the exclusion box's bottom edge and the picker's title row. */
export const PICKER_BAND_GAP_PX = 16;
/** Least gap between the own cell's orbit extent at `CELL_MAX_MASS` and the picker's title row (Z1, decision #324). */
export const PICKER_BAND_ORBIT_CLEARANCE_PX = 4;
/** Gap between the picker's title row, timer bar and card row. */
export const PICKER_ROW_GAP_PX = 12;
/** The timer bar's width at scale 1; its height is `DNA_RING_STROKE_PX`, the width of every chrome fill bar. */
export const PICKER_TIMER_BAR_WIDTH_PX = 470;
/**
 * One card at scale 1 (decision #425, option B). The width is what it takes for every catalog card to fit the height:
 * at 170 the names and effects wrapped far enough that Amoeba Pseudopods `I → II` needed 225 px and the Diatom Shell
 * upgrades 220 px, so they overflowed the card. At 240 the catalog's tallest card measures 192 px and a hypothetical
 * `PICKER_CARD_EFFECT_LINES_MAX`-line card 208 px, both inside the height, which is unchanged so that #384's band
 * anchor and the 1280 × 800 bottom edge stay where they are. Its key chip sits inside it. (Border box, so every
 * figure includes the card's 1 px rim; `qa/evidence/pr-441/` measured them and holds the harness that re-runs them.)
 */
export const PICKER_CARD_WIDTH_PX = 240;
export const PICKER_CARD_HEIGHT_PX = 214;
/** Gap between two cards. */
export const PICKER_CARD_GAP_PX = 10;
/** The glyph medallion at the top of a card: the trait's glyph at the card LOD (`glyphs/trait-glyph.component.ts`). */
export const PICKER_CARD_MEDALLION_PX = TRAIT_GLYPH_CARD_PX;
/** The highlighted card lifts this far. */
export const PICKER_CARD_LIFT_PX = 8;
/** The dim over the dish while an offer is open; the exclusion disc stays clear. */
export const PICKER_DIM_ALPHA = 0.55;
/**
 * Effect lines a card has room for. The catalog's longest tier row has three (the diatom shell's speed cost, the
 * simple flagellum's sprint cooldown); the fourth is the headroom decision #425 bought with the wider card, and the
 * human set it as the ceiling: a fifth line is not wanted, it buys a taller card or shorter words instead. Lines are
 * never cut; the spec fails the gate when a row outgrows this.
 */
export const PICKER_CARD_EFFECT_LINES_MAX = 4;
/** The dim's clear disc as a share of where its soft edge reaches full dim: the fade runs from the disc to disc / this. */
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

// ---- menu (docs/ui/overlays.md §3.5) ----

/** The menu panel's width at scale 1: Mitochondrion I's two effects fit on one line. */
export const MENU_PANEL_WIDTH_PX = 400;
/** A `Your traits` row with one effect line, at scale 1. */
export const MENU_TRAIT_ROW_HEIGHT_PX = 48;
/** Each further effect line a row grows by, at scale 1. */
export const MENU_TRAIT_LINE_HEIGHT_PX = 16;
/** Rows the list shows before it scrolls, so the panel never outgrows the viewport. */
export const MENU_TRAITS_VISIBLE_ROWS = 5;
/** The callout-backing scrim behind the menu: lighter than the encyclopedia's, so the dish reads through it. */
export const MENU_SCRIM_ALPHA = 0.5;

// ---- notices (docs/ui/overlays.md §3.6, docs/ui/input-and-onboarding.md §6) ----

/** The connection banner and the server-error line under it: full width, this tall at scale 1. */
export const NOTICE_ROW_HEIGHT_PX = 32;
/** The notices stack down from the top of the viewport and never past this y at scale 1. */
export const NOTICE_STACK_MAX_Y_PX = 96;
/** While the socket is down the last snapshot stays on screen, dimmed by this much. */
export const CONNECTION_LOST_DIM_ALPHA = 0.2;
/** The death overlay's dim (docs/ui/overlays.md §3.3): light, since the player is watching their killer through it. */
export const RESPAWN_DIM_ALPHA = 0.3;
/** Its text block starts where the notice stack must end, so a banner never sits on the killer's name. */
export const RESPAWN_TEXT_TOP_PX = NOTICE_STACK_MAX_Y_PX;
/** The text block's width at scale 1, centred. */
export const RESPAWN_TEXT_WIDTH_PX = 360;
/** The notices' text inset from the viewport's left and right edges. */
export const NOTICE_PADDING_INLINE_PX = 16;
/** Gap between a notice's message and its dismiss control. */
export const NOTICE_GAP_PX = 16;
/** The rim under a notice row, in its tone's colour. */
export const NOTICE_RIM_PX = 2;

// ---- onboarding (docs/ui/input-and-onboarding.md §5, docs/ui/layout.md §1) ----

/** A timed hint's time on screen; the pill's size is the notice row's (`NOTICE_ROW_HEIGHT_PX`, its inline padding). */
export const HINT_DURATION_SECONDS = 4;
/** Distance the own cell travels, in world units, before the steer hint goes. */
export const STEER_HINT_DISTANCE_WU = 200;
/** Round time at which the sprint hint shows if the player has never sprinted. */
export const SPRINT_HINT_AT_SECONDS = 30;
/** A coach beat's role-colour rim on the hint pill; an opening beat has none. */
export const HINT_RIM_PX = 2;
/** Coach beats waiting behind the pill that is up; a newer one past this drops the oldest, unseen. */
export const COACH_QUEUE_MAX = 2;
/** The mass trend reads `down` from decay this long before the `shrink` beat fires: a sprint alone does not. */
export const COACH_SHRINK_HOLD_SECONDS = 3;
/** Edge-to-edge distance, in own radii, at which an edible cell fires the `prey` beat. */
export const COACH_PREY_REACH_RADII = 4;
/**
 * The least time a hint the player's own action can dismiss stays up first: the prey beat fires moments before the
 * engulf that would end it, and a pill that flashes for a frame teaches nothing.
 */
export const HINT_MIN_SECONDS = 1.5;

// ---- the hold-Tab "affecting you" panel (docs/ui/overlays.md §3.7, decision #324) ----

/**
 * The window the `Food` row's gain rate is measured over: long enough that grazing reads as a
 * steady rate rather than a figure that jumps to zero between two motes.
 */
export const AFFECTING_FOOD_WINDOW_SECONDS = 5;
/**
 * The span the mass sparkline draws: long enough that a trip across a vent reads as "grew, then
 * shrank" rather than as the last second's noise.
 */
export const AFFECTING_MASS_HISTORY_SECONDS = 30;
/**
 * The least time between two kept mass samples. Snapshots arrive far faster than the sparkline can
 * draw, so the history keeps one point per interval instead of one per snapshot: the drawing is the
 * same and the memory is bounded at `AFFECTING_MASS_HISTORY_SECONDS / this` points.
 */
export const AFFECTING_MASS_SAMPLE_SECONDS = 0.5;
/** The sparkline's box at scale 1; its width is the panel's body less the mass and rate beside it. */
export const AFFECTING_SPARKLINE_WIDTH_PX = 120;
export const AFFECTING_SPARKLINE_HEIGHT_PX = 20;
/** The sparkline's stroke: one px reads as a hair at scale 1 and disappears under the scale floor. */
export const AFFECTING_SPARKLINE_STROKE_PX = 1.5;
/** Between the mass numeral, its trend glyph, its rate and the sparkline. */
export const AFFECTING_MASS_ROW_GAP_PX = 8;
