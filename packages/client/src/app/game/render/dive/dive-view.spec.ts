// One frame of the dive worked out before it draws (docs/rendering/opening-dive.md §3).

import { describe, expect, it } from 'vitest';
import { diveViewAt, isSameViewport, mockupDevicePixelRatio, mockupFrameOf } from './dive-view';

describe('mockupDevicePixelRatio', () => {
  it('draws the upper bands at the screen’s ratio up to 2× when still, and at most 1.5× while falling', () => {
    expect(mockupDevicePixelRatio(3, false)).toBe(2);
    expect(mockupDevicePixelRatio(3, true)).toBe(1.5);
    expect(mockupDevicePixelRatio(1, true)).toBe(1);
  });
});

describe('mockupFrameOf', () => {
  it('hands the mockup the camera, the planet’s turn and the band table', () => {
    const view = diveViewAt({ zoom: 5, viewport: { width: 800, height: 450 }, timeSeconds: 3, isMoving: true });
    const frame = mockupFrameOf(view, 2);
    expect(frame).toMatchObject({ zoom: 5, timeSeconds: 3, widthPx: 800, heightPx: 450, devicePixelRatio: 1.5 });
    expect(frame.globeRotation).toBe(view.globeRotation);
    expect(frame.bands).toBe(view.bands);
    expect(frame.bands.planet.isActive).toBe(true);
  });
});

describe('isSameViewport', () => {
  it('compares sizes, not objects', () => {
    expect(isSameViewport({ width: 4, height: 3 }, { width: 4, height: 3 })).toBe(true);
    expect(isSameViewport({ width: 4, height: 3 }, { width: 4, height: 2 })).toBe(false);
  });
});
