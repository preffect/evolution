// Viewport culling (docs/architecture/wire-contract.md §4.2 lever 1): each viewer is sent only the food and the DNA
// fragments inside its interest area, the view of its camera (`camera/camera-follow.ts`, which the server runs per
// viewer) over its last few broadcasts, grown by a margin (`camera/interest-margin.ts`, over the room's live balance).
// These are the parts that do not depend on the balance: engineering constants, not in `balance.json`.

import { INTERPOLATION_DELAY_INTERVALS } from './netcode.js';

/**
 * The widest canvas, width over height, whose sides are never culled. The vertical extent is authoritative
 * (docs/game-design/controls-and-scope.md §7) and the server is not told the canvas, so this covers a 21:9 screen
 * and a maximised browser window on a 16:9 or 16:10 one (about 2). A wider canvas (32:9, or a short wide window) sees
 * food appear at its far sides: a known limit, until the client caps its drawn width at this ratio (#408).
 */
export const INTEREST_VIEW_ASPECT_RATIO = 2.4;

/** The two states beyond the render delay: the newest, and one more for a snapshot that arrives late. */
const INTEREST_BROADCASTS_BEYOND_THE_RENDER_DELAY = 2;

/**
 * Camera states the area spans: the newest, the broadcasts the client renders behind it
 * (`INTERPOLATION_DELAY_INTERVALS`, the render delay counted in whole broadcasts, which is where that
 * division lives — #287), and one more for a snapshot that arrives late.
 */
export const INTEREST_CAMERA_HISTORY_BROADCASTS =
  INTERPOLATION_DELAY_INTERVALS + INTEREST_BROADCASTS_BEYOND_THE_RENDER_DELAY;

/** How far a mote or a fragment is drawn, in its radii: the widest food glow (`ALGAE_GLOW.wide`, 3) and one more. */
export const INTEREST_ENTITY_REACH_RADII = 4;
