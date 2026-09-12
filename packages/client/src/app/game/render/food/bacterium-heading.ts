// A bacterium's heading is not on the wire (docs/RENDERING.md §1): it is the direction of its
// interpolated displacement, held when still, so a rod points where it walks and never snaps
// back between random-walk steps. The memory is updated in place: the food layer keeps one per
// mote and advances 1 400 of them per frame without allocating.

import { BACTERIUM_HEADING_STILL_WU } from '../constants';

export interface HeadingMemory {
  x: number;
  y: number;
  heading: number;
  /** `false` until the first position is seen: the first frame has no displacement to read. */
  hasPosition: boolean;
}

const FIRST_HEADING = 0;

export function createHeadingMemory(): HeadingMemory {
  return { x: 0, y: 0, heading: FIRST_HEADING, hasPosition: false };
}

/** Moves the memory to `(x, y)`: the heading becomes the displacement's direction, or holds when still. */
export function advanceHeading(memory: HeadingMemory, x: number, y: number): void {
  const deltaX = x - memory.x;
  const deltaY = y - memory.y;
  if (memory.hasPosition && Math.hypot(deltaX, deltaY) >= BACTERIUM_HEADING_STILL_WU) {
    memory.heading = Math.atan2(deltaY, deltaX);
  }
  memory.x = x;
  memory.y = y;
  memory.hasPosition = true;
}
