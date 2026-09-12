// A bacterium's heading is not on the wire (docs/RENDERING.md §1): it is the direction of its
// interpolated displacement, held when still, so a rod points where it walks and never snaps
// back between random-walk steps. Pure; the food layer keeps one memory per mote.

import { BACTERIUM_HEADING_STILL_WU } from '../constants';

export interface HeadingMemory {
  readonly x: number;
  readonly y: number;
  readonly heading: number;
}

const FIRST_HEADING = 0;

/** The heading after moving to `(x, y)`: the displacement's direction, or the held one when still. */
export function nextHeading(memory: HeadingMemory | null, x: number, y: number): HeadingMemory {
  if (memory === null) return { x, y, heading: FIRST_HEADING };
  const deltaX = x - memory.x;
  const deltaY = y - memory.y;
  if (Math.hypot(deltaX, deltaY) < BACTERIUM_HEADING_STILL_WU) return { x, y, heading: memory.heading };
  return { x, y, heading: Math.atan2(deltaY, deltaX) };
}
