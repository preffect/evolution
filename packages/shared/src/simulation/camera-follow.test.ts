import { describe, expect, it } from 'vitest';
import {
  CAMERA_FOLLOW_SECONDS,
  CAMERA_MAX_VIEW_HALF_HEIGHT_WU,
  CAMERA_MIN_VIEW_HALF_HEIGHT_WU,
  CAMERA_VIEW_RADII,
} from '../constants/camera.js';
import { DISH_RADIUS } from '../constants/world.js';
import { parkCamera, stepCamera, viewHalfHeightFor } from './camera-follow.js';

describe('viewHalfHeightFor', () => {
  it('scales with the radius between the zoom limits', () => {
    expect(viewHalfHeightFor(40)).toBe(CAMERA_VIEW_RADII * 40);
    expect(viewHalfHeightFor(1)).toBe(CAMERA_MIN_VIEW_HALF_HEIGHT_WU);
    expect(viewHalfHeightFor(10_000)).toBe(CAMERA_MAX_VIEW_HALF_HEIGHT_WU);
  });
});

describe('parkCamera and stepCamera', () => {
  it('parks on the target without smoothing', () => {
    expect(parkCamera({ x: 10, y: -20, radius: 40 })).toEqual({ x: 10, y: -20, viewHalfHeightWu: 480 });
  });

  it('follows the target exponentially and zooms more slowly', () => {
    const start = parkCamera({ x: 0, y: 0, radius: 25 });
    const stepped = stepCamera(start, { x: 100, y: 0, radius: 50 }, CAMERA_FOLLOW_SECONDS);
    expect(stepped.x).toBeCloseTo(100 * (1 - Math.exp(-1)), 6);
    expect(stepped.y).toBe(0);
    const zoomShare = (stepped.viewHalfHeightWu - start.viewHalfHeightWu) / (600 - start.viewHalfHeightWu);
    expect(zoomShare).toBeLessThan(1 - Math.exp(-1));
    expect(zoomShare).toBeGreaterThan(0);
  });

  it('holds with no target and converges on the target over time', () => {
    const start = parkCamera({ x: 0, y: 0, radius: 25 });
    expect(stepCamera(start, null, 1)).toBe(start);
    let state = start;
    for (let frame = 0; frame < 600; frame += 1) state = stepCamera(state, { x: 50, y: 50, radius: 40 }, 1 / 60);
    expect(state.x).toBeCloseTo(50, 3);
    expect(state.viewHalfHeightWu).toBeCloseTo(480, 2);
  });

  it('never centres outside the dish', () => {
    const far = parkCamera({ x: DISH_RADIUS * 2, y: 0, radius: 20 });
    expect(far.x).toBe(DISH_RADIUS);
    const stepped = stepCamera(far, { x: DISH_RADIUS * 3, y: DISH_RADIUS * 3, radius: 20 }, 10);
    expect(Math.hypot(stepped.x, stepped.y)).toBeCloseTo(DISH_RADIUS, 6);
  });

  it('lands where per-frame steps land when stepped once over the same span', () => {
    // The server steps a viewer's camera once per broadcast, the client once per frame: one smoother, any step size.
    const start = parkCamera({ x: 0, y: 0, radius: 25 });
    const target = { x: 300, y: -120, radius: 60 };
    let framed = start;
    for (let frame = 0; frame < 3; frame += 1) framed = stepCamera(framed, target, 1 / 60);
    const once = stepCamera(start, target, 3 / 60);
    expect(once.x).toBeCloseTo(framed.x, 9);
    expect(once.y).toBeCloseTo(framed.y, 9);
    expect(once.viewHalfHeightWu).toBeCloseTo(framed.viewHalfHeightWu, 9);
  });
});
