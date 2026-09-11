import { describe, expect, it } from 'vitest';
import {
  CAMERA_FOLLOW_SECONDS,
  CAMERA_MAX_VIEW_HALF_HEIGHT_WU,
  CAMERA_MIN_VIEW_HALF_HEIGHT_WU,
  CAMERA_VIEW_RADII,
  DISH_RADIUS,
} from '@evolution/shared';
import {
  cameraExtent,
  isDiscInExtent,
  screenToWorld,
  parkCamera,
  stepCamera,
  viewHalfHeightFor,
  worldToScreen,
  zoomFor,
} from './camera';

const VIEWPORT = { width: 1920, height: 1080 };

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
});

describe('zoom, extent and projections', () => {
  const state = { x: 100, y: 50, viewHalfHeightWu: 540 };

  it('derives px per wu from the vertical extent', () => {
    expect(zoomFor(state, VIEWPORT)).toBe(1);
    expect(zoomFor({ ...state, viewHalfHeightWu: 300 }, VIEWPORT)).toBeCloseTo(1.8, 9);
  });

  it('spans the viewport aspect around the centre', () => {
    expect(cameraExtent(state, VIEWPORT)).toEqual({ minX: -860, maxX: 1060, minY: -490, maxY: 590 });
    expect(cameraExtent(state, { width: 100, height: 0 }).maxX).toBe(640);
  });

  it('maps world to screen and back', () => {
    const screen = worldToScreen(state, VIEWPORT, 100, 50);
    expect(screen).toEqual({ x: 960, y: 540 });
    expect(screenToWorld(state, VIEWPORT, 960 + 10, 540 - 10)).toEqual({ x: 110, y: 40 });
  });

  it('culls a disc outside the extent and keeps one that reaches in', () => {
    const extent = cameraExtent(state, VIEWPORT);
    expect(isDiscInExtent(extent, 1075, 50, 10)).toBe(true);
    expect(isDiscInExtent(extent, 1085, 50, 10)).toBe(false);
    expect(isDiscInExtent(extent, 1200, 50, 100)).toBe(true);
  });
});
