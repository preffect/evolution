// Pure 2-D helpers the simulation and the client share (docs/ARCHITECTURE.md §10). Every function
// takes numbers and returns plain data; a random draw is passed in as the number it produced,
// never as a source (docs/DETERMINISM.md §3).

import { RADIANS_PER_FULL_TURN } from '../constants/units.js';
import type { Vec2 } from '../types/common.js';

export function distanceBetween(from: Vec2, target: Vec2): number {
  return Math.hypot(target.x - from.x, target.y - from.y);
}

/** The unit vector from `from` toward `target`; the zero vector when the points coincide. */
export function unitVectorToward(from: Vec2, target: Vec2): Vec2 {
  const deltaX = target.x - from.x;
  const deltaY = target.y - from.y;
  const length = Math.hypot(deltaX, deltaY);
  return length === 0 ? { x: 0, y: 0 } : { x: deltaX / length, y: deltaY / length };
}

export function pointOnCircle(radius: number, angleRadians: number): Vec2 {
  return { x: radius * Math.cos(angleRadians), y: radius * Math.sin(angleRadians) };
}

/**
 * A point uniform by area in the annulus `innerRadius .. outerRadius` around the origin, from two
 * uniform draws in [0, 1): the radius is the square-root mix (area ∝ r²), the angle a full turn.
 * `innerRadius` 0 gives a disc.
 */
export function uniformPointInAnnulus(
  innerRadius: number,
  outerRadius: number,
  unitRadial: number,
  unitAngle: number,
): Vec2 {
  const radius = Math.sqrt(
    innerRadius * innerRadius + unitRadial * (outerRadius * outerRadius - innerRadius * innerRadius),
  );
  return pointOnCircle(radius, unitAngle * RADIANS_PER_FULL_TURN);
}

/** `centre` plus a point uniform in the disc of `radius` around it. */
export function uniformPointInDiscAround(centre: Vec2, radius: number, unitRadial: number, unitAngle: number): Vec2 {
  const offset = uniformPointInAnnulus(0, radius, unitRadial, unitAngle);
  return { x: centre.x + offset.x, y: centre.y + offset.y };
}
