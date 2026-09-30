// The upgrade and form popups' numbers (docs/ui/overlays.md §3.8, docs/ui/layout.md §1, #783): HUD constants like
// `hud-constants.ts`'s, in a file of their own so that one stays under the size limit. Published to the stylesheet by
// `format/hud-css-variables.ts`.

import { PICKER_CARD_WIDTH_PX } from './hud-constants';

/** An upgrade popup's whole life, pop-in to faded, counted in room ticks; the next queued one starts after it. */
export const UPGRADE_POPUP_DURATION_SECONDS = 2.5;
/** Its pop-in at the start of that life. */
export const UPGRADE_POPUP_IN_MS = 200;
/** Its rise and fade at the end of that life. */
export const UPGRADE_POPUP_OUT_MS = 700;
/** How far it rises while it fades, at scale 1. */
export const UPGRADE_POPUP_RISE_PX = 24;
/** The scale it pops in from. */
export const UPGRADE_POPUP_FROM_SCALE = 0.85;
/** Its widest, at scale 1: a card's width, so a card's effect lines fit on theirs. */
export const UPGRADE_POPUP_MAX_WIDTH_PX = PICKER_CARD_WIDTH_PX;
/** A form popup's whole life: about five seconds held between its entrance and its fade. */
export const FORM_POPUP_DURATION_SECONDS = 6;
/** Its entrance's first beat: it grows past full size to the overshoot while its glow flares. */
export const FORM_POPUP_IN_MS = 350;
/** The second beat: it settles from the overshoot to full size and its glow back to rest. */
export const FORM_POPUP_SETTLE_MS = 250;
/** Its fade. */
export const FORM_POPUP_OUT_MS = 700;
/** The scale it grows from. */
export const FORM_POPUP_FROM_SCALE = 0.6;
/** The scale its entrance overshoots to before it settles at 1. */
export const FORM_POPUP_OVERSHOOT_SCALE = 1.06;
/**
 * Its widest, at scale 1: the display-size name on one line and a four-line effect row on two, so the tallest form
 * (Amoeba Pseudopods) still fits between the HUD margin and the cell's clearance at 1024 × 640.
 */
export const FORM_POPUP_MAX_WIDTH_PX = 640;
/** The resting glow in the player's seat colour around it, at scale 1; the popup keeps this far from the cell. */
export const FORM_POPUP_GLOW_PX = 24;
/** The glow's one flare at the top of the entrance, as a multiple of the resting glow. */
export const FORM_POPUP_GLOW_FLARE = 2.5;
/** Its rim in the seat colour; also the expanding ring's width. */
export const FORM_POPUP_RIM_PX = 2;
/** The name's size, as a multiple of the kit's `headline` role: a display size for the moment, not a new role. */
export const FORM_POPUP_TITLE_SCALE = 1.5;
/** The ring that expands once from its rim, behind it. */
export const FORM_POPUP_RING_MS = 900;
/** The scale the ring expands to, about its centre, as it fades: its reach stays inside the resting glow's margin. */
export const FORM_POPUP_RING_SCALE = 1.25;
/**
 * The death overlay's three lines at scale 1 (docs/ui/overlays.md §3.3): measured 77 px on PR #789, with headroom.
 * While the player is dead, the popups hang below them.
 */
export const RESPAWN_TEXT_HEIGHT_PX = 80;
/** Gap between the death overlay's text and a popup under it while the player is dead. */
export const UPGRADE_POPUP_DEATH_TEXT_GAP_PX = 16;
