// The graze's choice of mote (docs/ecology/wild-cells.md §3.3.3, docs/ecology/giants.md §3.5.7): the nearest mote in
// sight its diet eats; a diet with a forward cone (the grazing giant's, `GIANT_GRAZER_FORWARD_HALF_ANGLE_DEGREES` 60)
// takes the nearest of those whose bearing lies within the cone first, and the nearest in sight only when none does,
// so it sweeps lanes and never doubles back for a mote behind while one lies ahead. Forward is the cell's velocity's
// direction, or its seat's wander heading while it is at rest, a velocity of exactly (0, 0) as a placement or a
// respawn leaves it (no threshold). Ties keep the earlier mote in the world's order, which is mint order, so the lower
// entity id. One dot product per mote in sight; no randomness.

import { DEGREES_PER_FULL_TURN, RADIANS_PER_FULL_TURN, type Vec2 } from '@evolution/shared';
import type { CellDiet } from '../simulation/cell-diet.js';
import type { CellRecord, SeatMindRecord } from '../world/entities.js';

/** The unit direction the cell calls ahead: its velocity's, or its seat's heading while its velocity is exactly zero. */
export function forwardOf(cell: CellRecord, seat: SeatMindRecord): Vec2 {
  const speed = Math.hypot(cell.velocityX, cell.velocityY);
  if (speed === 0) {
    return { x: seat.headingX, y: seat.headingY };
  }
  return { x: cell.velocityX / speed, y: cell.velocityY / speed };
}

/** Whether `point`'s bearing from `origin` lies within `halfAngleDegrees` of the unit `forward`, the edge included. */
export function isWithinForwardCone(origin: Vec2, point: Vec2, forward: Vec2, halfAngleDegrees: number): boolean {
  const offsetX = point.x - origin.x;
  const offsetY = point.y - origin.y;
  const halfAngleRadians = (halfAngleDegrees / DEGREES_PER_FULL_TURN) * RADIANS_PER_FULL_TURN;
  return offsetX * forward.x + offsetY * forward.y >= Math.hypot(offsetX, offsetY) * Math.cos(halfAngleRadians);
}

/**
 * The motes the graze takes its nearest from: those ahead of the cell when its diet has a cone and any lies within it,
 * else all of `motes`.
 */
export function grazeCandidatesOf<Mote extends Vec2>(
  motes: readonly Mote[],
  cell: CellRecord,
  seat: SeatMindRecord,
  diet: CellDiet,
): readonly Mote[] {
  const halfAngle = diet.forwardHalfAngleDegrees;
  if (halfAngle === null) {
    return motes;
  }
  const forward = forwardOf(cell, seat);
  const ahead = motes.filter((mote) => isWithinForwardCone(cell, mote, forward, halfAngle));
  return ahead.length > 0 ? ahead : motes;
}
