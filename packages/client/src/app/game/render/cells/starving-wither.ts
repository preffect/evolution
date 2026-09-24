// A starving wild cell fades and shrivels (docs/ecology/wild-cells.md §3.3.6, ticket #557 question 2 = A, #635): how
// far it has withered, from the view and the world clock, and what that does to its organelle sprites' tint. The
// shader reads the same `wither` for the palette and the rim, the shape terms for the wrinkle
// (visual-style/motion-and-legibility.md §5 "Starving"). Pure: no state, so a cell that starts starving mid-view, or
// a client that joins mid-starve, draws exactly what every other client draws.

import { lerp, ticksToSeconds, worldReference, type BalanceConfig, type CellView } from '@evolution/shared';
import { hexToRgb, rgbToHex } from '../colour';
import { STARVING_ORGANELLE_SALLOW_SHARE, STARVING_SALLOW, STARVING_WITHER_ONSET } from '../constants';

/** A cell that is not starving. */
export const NOT_WITHERED = 0;
const FULLY_WITHERED = 1;

/**
 * The mass a starving cell bursts at on `renderTick`: `WILD_CELL_SIZE_FACTOR_MIN × worldMass`, the smallest newborn
 * (§3.3.6 "Bursting", the server's `isStarvedOut`). The elapsed time is not frozen at the round's end the way
 * `worldElapsedSeconds` freezes it: a cell starves only while the round plays, so the freeze never reaches a
 * starving cell, and the render frame does not carry the round length.
 */
export function starvedOutMassAt(renderTick: number, roundStartTick: number, balance: BalanceConfig): number {
  const elapsedSeconds = ticksToSeconds(Math.max(0, renderTick - roundStartTick));
  return balance.wildCells.WILD_CELL_SIZE_FACTOR_MIN * worldReference(elapsedSeconds, balance).worldMass;
}

/**
 * 0 for a cell that is not starving; lerp(`STARVING_WITHER_ONSET`, 1, `starvedOutMass / mass`) for one that is, so it
 * is fully withered on the tick it bursts. The onset is only the floor: a starver starts at most
 * `1 / WILD_CELL_SIZE_FACTOR_MIN` times its burst mass, so a typical one starts at about 0.5. The server bursts on the full mass, the view
 * carries the mass, which a wound can hold under it; that only withers a wounded starver a little early.
 */
export function witherOf(view: Pick<CellView, 'isStarving' | 'mass'>, starvedOutMass: number): number {
  if (!view.isStarving) return NOT_WITHERED;
  const towardBurst = view.mass > 0 ? Math.min(FULLY_WITHERED, starvedOutMass / view.mass) : FULLY_WITHERED;
  return lerp(STARVING_WITHER_ONSET, FULLY_WITHERED, towardBurst);
}

/** An organelle sprite's tint on a withered cell: `tint` multiplied toward `STARVING_SALLOW` by the wither. */
export function witheredTint(tint: string, wither: number): string {
  if (wither <= NOT_WITHERED) return tint;
  const sallow = hexToRgb(STARVING_SALLOW);
  const share = wither * STARVING_ORGANELLE_SALLOW_SHARE;
  const [red, green, blue] = hexToRgb(tint);
  return rgbToHex([
    red * lerp(1, sallow[0], share),
    green * lerp(1, sallow[1], share),
    blue * lerp(1, sallow[2], share),
  ]);
}
