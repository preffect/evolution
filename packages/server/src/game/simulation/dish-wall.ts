// The dish wall for a cell moved or grown outside the kernel (docs/ecology/absorption.md §6.3, #710): nothing rides
// past the rim. The kernel's own clamp (`clampToDish`) runs on a moving cell; separation and a gain of mass at the
// wall go through here, which moves the centre only and leaves the velocity to the next tick's kernel.

import { clampToDish } from '@evolution/shared';
import type { CellRecord } from '../world/entities.js';

/** The part of a cell the wall reads and moves. */
export type DishBody = Pick<CellRecord, 'x' | 'y' | 'radius'>;

/** Puts the centre back inside `dishRadius − radius` when it lies past it (radially inward, as the kernel does). */
export function keepInsideDish(cell: DishBody, dishRadius: number): void {
  const clamped = clampToDish({ x: cell.x, y: cell.y, velocityX: 0, velocityY: 0 }, cell.radius, dishRadius);
  cell.x = clamped.x;
  cell.y = clamped.y;
}
