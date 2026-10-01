// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { POINTER_LOCK_MOVEMENT_SCALE } from './input-constants';
import { clampedToCanvas, virtualPointerMovedBy } from './virtual-pointer';

const CANVAS = { width: 1280, height: 800 };
const CENTRE = { x: 640, y: 400 };

describe('virtualPointerMovedBy', () => {
  it('moves by the reported movement times the named scale', () => {
    expect(virtualPointerMovedBy(CENTRE, { movementX: 30, movementY: -20 }, CANVAS)).toEqual({
      x: CENTRE.x + 30 * POINTER_LOCK_MOVEMENT_SCALE,
      y: CENTRE.y - 20 * POINTER_LOCK_MOVEMENT_SCALE,
    });
  });

  it('keeps the steer offset a real pointer would have had: one px of mouse is one px of offset', () => {
    // The steer target is the offset from the view centre (§4), so scale 1 is what keeps the dead zone and full
    // throttle where they are unlocked.
    expect(POINTER_LOCK_MOVEMENT_SCALE).toBe(1);
  });

  it('stops at every edge of the canvas however far the mouse travels', () => {
    expect(virtualPointerMovedBy(CENTRE, { movementX: -5000, movementY: -5000 }, CANVAS)).toEqual({ x: 0, y: 0 });
    expect(virtualPointerMovedBy(CENTRE, { movementX: 5000, movementY: 5000 }, CANVAS)).toEqual({
      x: CANVAS.width,
      y: CANVAS.height,
    });
  });

  it('comes straight back from an edge: the clamp keeps no debt of the movement past it', () => {
    const atEdge = virtualPointerMovedBy(CENTRE, { movementX: 5000, movementY: 0 }, CANVAS);
    expect(virtualPointerMovedBy(atEdge, { movementX: -10, movementY: 0 }, CANVAS).x).toBe(CANVAS.width - 10);
  });
});

describe('clampedToCanvas', () => {
  it('leaves a point inside alone and pulls one outside onto the edge', () => {
    expect(clampedToCanvas(CENTRE, CANVAS)).toEqual(CENTRE);
    expect(clampedToCanvas({ x: -1, y: 900 }, CANVAS)).toEqual({ x: 0, y: CANVAS.height });
  });
});
