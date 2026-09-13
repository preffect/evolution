// The player swatch on a leaderboard row (docs/UI.md §3.1.1): the seat's palette base, its rim
// ring, the seat-mark beads and the own row's tint, resolved once per row rather than per change
// detection. Pure: the palette is `render/palette.ts`'s (the same one the cell on the dish is drawn
// from, which is the whole point of the swatch), the bead geometry is `seat-mark.ts`'s.

import { paletteFor } from '../../render/palette';
import { LEADERBOARD_OWN_ROW_TINT_ALPHA } from '../hud-constants';
import { seatMarkBeadCount, seatMarkBeadPositions, type SeatMarkBead } from './seat-mark';
import { hexWithAlpha } from './tint';

export interface LeaderboardSwatch {
  /** The palette base: the cell's body colour on the dish. */
  readonly base: string;
  readonly rim: string;
  /** Bead centres in the swatch's own units, from the radius passed in. */
  readonly beads: readonly SeatMarkBead[];
  /** The own row's background: the same rim colour at 12 % (docs/VISUAL-STYLE.md §7). */
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
