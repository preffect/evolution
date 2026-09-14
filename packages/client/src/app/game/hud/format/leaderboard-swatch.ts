// The player swatch on a leaderboard row (docs/ui/hud.md §3.1.1): the seat's palette base, its rim
// ring, the seat-mark beads and the own row's tint, resolved once per row rather than per change
// detection. Pure: the palette is `render/palette.ts`'s (the same one the cell on the dish is drawn
// from, which is the whole point of the swatch), the bead geometry is `seat-mark.ts`'s.
//
// This file also owns the swatch's **scale**, because getting it wrong is silent: an SVG's viewBox
// and the CSS size of its element together decide how many pixels a user unit is worth, and every
// constant inside the drawing is multiplied by that. `leaderboardSwatchGeometry` states the whole
// relationship in one place and `pxPerUserUnit` is pinned at 1, so a constant means on screen what
// it says here.

import { paletteFor } from '../../render/palette';
import {
  LEADERBOARD_OWN_ROW_TINT_ALPHA,
  LEADERBOARD_SWATCH_BEAD_DIAMETER_PX,
  LEADERBOARD_SWATCH_DIAMETER_PX,
  LEADERBOARD_SWATCH_RING_WIDTH_PX,
} from '../hud-constants';
import { seatMarkBeadCount, seatMarkBeadPositions, type SeatMarkBead } from './seat-mark';
import { hexWithAlpha } from './tint';

const HALF = 2;

export interface LeaderboardSwatchGeometry {
  /** The `viewBox` attribute: the disc's own bounds, centred on the origin. */
  readonly viewBox: string;
  /** The viewBox's side, in user units. */
  readonly viewBoxSideUnits: number;
  /** The element's rendered side, in CSS px at HUD scale 1 (`--hud-leaderboard-swatch-size`). */
  readonly renderedSidePx: number;
  /**
   * CSS px per user unit. **Pinned at 1**: the beads and the ring are a couple of px wide, so any
   * other value rounds the seat mark away and the non-colour tell of docs/visual-style/principles-and-palette.md §2 stops
   * reaching the screen. The beads sit on the disc's outline and are wider than it, so they paint
   * outside the viewBox — the element carries `overflow: visible` for exactly that.
   */
  readonly pxPerUserUnit: number;
  readonly bodyRadius: number;
  readonly beadRadius: number;
  readonly ringWidth: number;
}

/** The one description of how the swatch's units reach the screen (docs/ui/hud.md §3.1.1). */
export function leaderboardSwatchGeometry(): LeaderboardSwatchGeometry {
  const viewBoxSideUnits = LEADERBOARD_SWATCH_DIAMETER_PX;
  const halfSide = viewBoxSideUnits / HALF;
  return {
    viewBox: [-halfSide, -halfSide, viewBoxSideUnits, viewBoxSideUnits].join(' '),
    viewBoxSideUnits,
    renderedSidePx: LEADERBOARD_SWATCH_DIAMETER_PX,
    pxPerUserUnit: LEADERBOARD_SWATCH_DIAMETER_PX / viewBoxSideUnits,
    bodyRadius: LEADERBOARD_SWATCH_DIAMETER_PX / HALF,
    beadRadius: LEADERBOARD_SWATCH_BEAD_DIAMETER_PX / HALF,
    ringWidth: LEADERBOARD_SWATCH_RING_WIDTH_PX,
  };
}

export interface LeaderboardSwatch {
  /** The palette base: the cell's body colour on the dish. */
  readonly base: string;
  readonly rim: string;
  /** Bead centres in the swatch's own units, from the radius passed in. */
  readonly beads: readonly SeatMarkBead[];
  /** The own row's background: the same rim colour at 12 % (docs/visual-style/ui-type.md §7). */
  readonly ownRowTint: string;
}

export function leaderboardSwatchFor(avatarIndex: number, bodyRadius: number): LeaderboardSwatch {
  const palette = paletteFor(avatarIndex);
  return {
    base: palette.base,
    rim: palette.rim,
    beads: seatMarkBeadPositions(seatMarkBeadCount(avatarIndex), bodyRadius),
    ownRowTint: hexWithAlpha(palette.rim, LEADERBOARD_OWN_ROW_TINT_ALPHA),
  };
}
