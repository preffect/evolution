// The wild wander (docs/ecology/wild-cells.md §3.3, the "wander" row): the seat keeps a unit heading
// (`headingX/Y`, hashed state, drawn at placement); per decision it draws a new uniform heading with probability
// `WILD_CELL_TURN_CHANCE`, else keeps it, and aims `STEER_FULL_THROTTLE_RADII` own radii along it. A target
// outside the placement disc (`DISH_RADIUS − SPAWN_EDGE_MARGIN`, the disc the seats are placed in) is redrawn up to
// `SPAWN_POINT_MAX_ATTEMPTS` times, then the origin is the target. Every draw is from the `wildCells` stream the
// caller hands in; the turn roll and the heading angle are one `nextFloat()` each.

import {
  pointOnCircle,
  RADIANS_PER_FULL_TURN,
  type BalanceConfig,
  type RandomSource,
  type Vec2,
} from '@evolution/shared';
import { spawnReach } from '../simulation/spawn-placement.js';
import type { WildSeatRecord } from '../world/entities.js';

const UNIT_LENGTH = 1;
const ORIGIN: Vec2 = { x: 0, y: 0 };

/** A uniform unit heading; one draw. */
export function drawWildHeading(random: RandomSource): Vec2 {
  return pointOnCircle(UNIT_LENGTH, random.nextFloat() * RADIANS_PER_FULL_TURN);
}

export function setSeatHeading(seat: WildSeatRecord, heading: Vec2): void {
  seat.headingX = heading.x;
  seat.headingY = heading.y;
}

/** The wander target: `STEER_FULL_THROTTLE_RADII` own radii from the centre along the seat's heading. */
export function pointAlongHeading(seat: WildSeatRecord, cell: Vec2 & { radius: number }, balance: BalanceConfig): Vec2 {
  const reach = balance.controls.STEER_FULL_THROTTLE_RADII * cell.radius;
  return { x: cell.x + seat.headingX * reach, y: cell.y + seat.headingY * reach };
}

export function isInsideWanderDisc(point: Vec2, balance: BalanceConfig): boolean {
  return Math.hypot(point.x, point.y) <= spawnReach(balance);
}

/** One wander decision: the turn roll, the heading it may draw, the redraws against the disc. */
export function wanderTargetOf(
  seat: WildSeatRecord,
  cell: Vec2 & { radius: number },
  random: RandomSource,
  balance: BalanceConfig,
): Vec2 {
  if (random.nextFloat() < balance.wildCells.WILD_CELL_TURN_CHANCE) {
    setSeatHeading(seat, drawWildHeading(random));
  }
  let target = pointAlongHeading(seat, cell, balance);
  for (
    let redraw = 0;
    redraw < balance.ecology.SPAWN_POINT_MAX_ATTEMPTS && !isInsideWanderDisc(target, balance);
    redraw += 1
  ) {
    setSeatHeading(seat, drawWildHeading(random));
    target = pointAlongHeading(seat, cell, balance);
  }
  return isInsideWanderDisc(target, balance) ? target : ORIGIN;
}
