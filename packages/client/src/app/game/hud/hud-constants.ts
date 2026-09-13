// The HUD's own numbers (docs/CODE-STANDARDS.md §2): the layout frame of docs/UI.md §1 and the
// chrome sizes of §3.1.1, which that doc owns and this file declares exactly once. Colours and the
// type scale are docs/VISUAL-STYLE.md's and live in `render/constants`; gameplay numbers are the
// shared balance, reached through the live `game_state.balance` — nothing here is a copy of one.
//
// Only the constants the chrome (#185) needs are declared; #186–#190 add their own rows as they land.

// ---- layout frame (docs/UI.md §1) ----

/** Viewport width at which `--hud-scale` is 1. */
export const HUD_REFERENCE_VIEWPORT_WIDTH_PX = 1280;
/** Viewport height at which `--hud-scale` is 1. */
export const HUD_REFERENCE_VIEWPORT_HEIGHT_PX = 800;
/** Lower bound of `--hud-scale`. */
export const HUD_SCALE_MIN = 0.8;
/** Upper bound of `--hud-scale`. */
export const HUD_SCALE_MAX = 1.5;
/** Corner margin at scale 1: every chrome element anchors to its corner with this. */
export const HUD_MARGIN_PX = 16;

// ---- leaderboard (docs/UI.md §3.1.1) ----

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
/** A row slides to its new rank over this, so a re-sort reads as movement and not as a jump. */
export const LEADERBOARD_ROW_SLIDE_MS = 200;
/** The own row is tinted with the player's own rim colour at this alpha (docs/VISUAL-STYLE.md §7). */
export const LEADERBOARD_OWN_ROW_TINT_ALPHA = 0.12;
/** Diameter of the player swatch at scale 1. */
export const LEADERBOARD_SWATCH_DIAMETER_PX = 10;
/**
 * The seat-mark beads sit on the swatch's outline (docs/VISUAL-STYLE.md §2); this is their own
 * diameter at scale 1. Wider than the ring on purpose: at a 10 px swatch a bead narrower than this
 * antialiases into the rim and the non-colour tell stops being readable, which is its whole job.
 */
export const LEADERBOARD_SWATCH_BEAD_DIAMETER_PX = 3;
/** The swatch's rim-colour ring width at scale 1. */
export const LEADERBOARD_SWATCH_RING_WIDTH_PX = 1.2;

// ---- round clock (docs/UI.md §3.1.1) ----

/** Inside the last this many seconds the clock pulses once per second. */
export const ROUND_CLOCK_PULSE_LAST_SECONDS = 10;
/** One pulse per second. */
export const ROUND_CLOCK_PULSE_PERIOD_MS = 1000;
