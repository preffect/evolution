import { describe, expect, it } from 'vitest';
import { cameraExtent, isDiscInExtent, screenOffsetToWorld, screenToWorld, worldToScreen, zoomFor } from './camera';

const VIEWPORT = { width: 1920, height: 1080 };

// The follow and the zoom are shared and tested with them (`shared/src/simulation/camera-follow.test.ts`).
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

  it('answers the same point as an offset from the middle of the view, free of the centre', () => {
    expect(screenOffsetToWorld(state, VIEWPORT, 960 + 10, 540 - 10)).toEqual({ x: 10, y: -10 });
    const moved = { ...state, x: 5000, y: -5000 };
    expect(screenOffsetToWorld(moved, VIEWPORT, 960 + 10, 540 - 10)).toEqual({ x: 10, y: -10 });
  });

  it('culls a disc outside the extent and keeps one that reaches in', () => {
    const extent = cameraExtent(state, VIEWPORT);
    expect(isDiscInExtent(extent, 1075, 50, 10)).toBe(true);
    expect(isDiscInExtent(extent, 1085, 50, 10)).toBe(false);
    expect(isDiscInExtent(extent, 1200, 50, 100)).toBe(true);
  });
});
