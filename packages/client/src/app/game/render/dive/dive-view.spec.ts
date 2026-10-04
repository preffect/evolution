// One frame of the dive worked out before it draws (docs/rendering/opening-dive.md §3).

import { describe, expect, it } from 'vitest';
import { diveViewAt, isSameViewport, upperBandsDevicePixelRatio } from './dive-view';

describe('upperBandsDevicePixelRatio', () => {
  it('caps the upper bands at the screen’s ratio up to 2× when still, and at most 1.5× while falling', () => {
    expect(upperBandsDevicePixelRatio(3, false)).toBe(2);
    expect(upperBandsDevicePixelRatio(3, true)).toBe(1.5);
    expect(upperBandsDevicePixelRatio(1, true)).toBe(1);
  });
});

describe('diveViewAt', () => {
  const inputs = { zoom: 5, viewport: { width: 800, height: 450 }, timeSeconds: 3, isMoving: true };

  it('holds the camera, the planet’s turn and the band table', () => {
    const view = diveViewAt({ ...inputs, globeIdleSpinDegrees: 0 });
    expect(view.camera.zoom).toBe(5);
    expect(view.camera.viewport).toEqual({ width: 800, height: 450 });
    expect(view.timeSeconds).toBe(3);
    expect(view.isMoving).toBe(true);
    expect(view.bands.planet.isActive).toBe(true);
    expect(view.hasSlimePictures).toBe(true);
    expect(diveViewAt({ ...inputs, globeIdleSpinDegrees: 0, hasSlimePictures: false }).hasSlimePictures).toBe(false);
  });

  it('turns the planet by its idle spin in orbit', () => {
    const still = diveViewAt({ ...inputs, zoom: 7.4, globeIdleSpinDegrees: 0 });
    const spun = diveViewAt({ ...inputs, zoom: 7.4, globeIdleSpinDegrees: 10 });
    expect(spun.globeRotation[0]).toBeCloseTo(still.globeRotation[0] - 10, 9);
  });
});

describe('isSameViewport', () => {
  it('compares sizes, not objects', () => {
    expect(isSameViewport({ width: 4, height: 3 }, { width: 4, height: 3 })).toBe(true);
    expect(isSameViewport({ width: 4, height: 3 }, { width: 4, height: 2 })).toBe(false);
  });
});
