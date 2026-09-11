// A bacterium's heading is not on the wire (docs/RENDERING.md §1): it is the direction of its
// interpolated displacement, held when still, so a rod points where it walks and never snaps
// back to zero between random-walk steps. Pure; the food layer keeps one memory per mote.

import { HEADING_HOLD_SPEED_RATIO } from '../constants';

export interface HeadingMemory {
  readonly x: number;
  readonly y: number;
  readonly heading: number;
}

/** A displacement shorter than this (wu) is stillness: quantised positions jitter by less. */
export const HEADING_STILL_WU = HEADING_HOLD_SPEED_RATIO;

/** The heading after moving to `(x, y)`: the displacement's direction, or the held one when still. */
export function nextHeading(memory: HeadingMemory | undefined, x: number, y: number): HeadingMemory {
  if (memory === undefined) return { x, y, heading: 0 };
  const deltaX = x - memory.x;
  const deltaY = y - memory.y;
  if (Math.hypot(deltaX, deltaY) < HEADING_STILL_WU) return { x, y, heading: memory.heading };
  return { x, y, heading: Math.atan2(deltaY, deltaX) };
}
