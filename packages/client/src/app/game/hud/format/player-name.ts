// How a player's name reads on screen (docs/ui/hud.md §3.1.1, docs/ui/overlays.md §3.7, #454): one cut for every
// place a name is shown, so the leaderboard, the threat labels and the hold-Tab panel's cause rows can never disagree
// about how long a name may run. The lobby caps a name at `PLAYER_NAME_MAX_LENGTH` (20); the screen shows at most
// `LEADERBOARD_NAME_MAX_CHARS` (12) of it.

import { LEADERBOARD_NAME_MAX_CHARS } from '../hud-constants';

const ELLIPSIS = '…';
/** A name is cut to the ellipsis plus this many of its own characters. */
const TRUNCATED_NAME_CHARS = LEADERBOARD_NAME_MAX_CHARS - ELLIPSIS.length;

/**
 * A name at most `LEADERBOARD_NAME_MAX_CHARS` long, ellipsised rather than clipped mid-glyph.
 * Counted and cut in code points, not UTF-16 units: a `String.slice` at the cut can land inside a
 * surrogate pair and leave a lone half, which renders as a replacement box.
 */
export function truncatePlayerName(name: string): string {
  const codePoints = [...name];
  if (codePoints.length <= LEADERBOARD_NAME_MAX_CHARS) return name;
  return `${codePoints.slice(0, TRUNCATED_NAME_CHARS).join('')}${ELLIPSIS}`;
}
