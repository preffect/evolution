// Plane geometry over `Vec2`-shaped points (docs/ARCHITECTURE.md §10): the one home of the
// distance the simulation, the bots and the client all measure with.

import type { Vec2 } from '../types/common.js';

/** The euclidean distance from `origin` to `target`, in the points' own units. */
export function distanceBetween(origin: Vec2, target: Vec2): number {
  return Math.hypot(target.x - origin.x, target.y - origin.y);
}
