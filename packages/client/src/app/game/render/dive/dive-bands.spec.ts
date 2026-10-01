// The band table (docs/rendering/opening-dive.md §3): which bands draw at a camera and how far each is faded in.
// The windows are the mockup's own numbers (its `sstep` calls and `z >` cuts), pinned literally, so a change to
// a window is a deliberate change to the design.

import { describe, expect, it } from 'vitest';
import {
  DIVE_BAND,
  DIVE_BAND_WINDOWS,
  DIVE_DISH_RADIUS_M,
  activeDiveBands,
  bandWeight,
  diveBandStates,
  isMockupDrawing,
  DIVE_MOCKUP_BAND_NAMES,
} from './dive-bands';
import { diveCameraAt } from './dive-camera';

const VIEWPORT = { width: 1200, height: 675 };
const statesAt = (zoom: number) => diveBandStates(diveCameraAt(zoom, VIEWPORT));

describe('DIVE_BAND_WINDOWS', () => {
  it('holds the mockup’s fades and cuts', () => {
    expect(DIVE_BAND_WINDOWS).toEqual({
      planet: { fadeFromZoom: null, fadeToZoom: null, cutAtZoom: 1.35 },
      shore: { fadeFromZoom: 4.85, fadeToZoom: 4.4, cutAtZoom: -1.42 },
      kelp: { fadeFromZoom: 2.4, fadeToZoom: 2.1, cutAtZoom: -1.42 },
      drop: { fadeFromZoom: 0.35, fadeToZoom: 0.05, cutAtZoom: -2.96 },
      slime: { fadeFromZoom: -1.95, fadeToZoom: -2.35, cutAtZoom: null },
      dish: { fadeFromZoom: -3.7, fadeToZoom: -4.22, cutAtZoom: null },
    });
  });
});

describe('bandWeight', () => {
  it('is 0 above the fade, 1 below it and smoothstepped between', () => {
    const window = DIVE_BAND_WINDOWS.shore;
    expect(bandWeight(window, 5)).toBe(0);
    expect(bandWeight(window, 4.85)).toBe(0);
    expect(bandWeight(window, 4.625)).toBeCloseTo(0.5, 9);
    expect(bandWeight(window, 4.4)).toBe(1);
    expect(bandWeight(window, -6)).toBe(1);
  });

  it('is 1 throughout for a band with no fade', () => {
    expect(bandWeight(DIVE_BAND_WINDOWS.planet, 7.4)).toBe(1);
  });
});

describe('diveBandStates', () => {
  it('draws only the planet in orbit', () => {
    expect(activeDiveBands(statesAt(7.3))).toEqual([DIVE_BAND.planet]);
  });

  it('cuts each band strictly below its cut, as the mockup’s `z > cut`', () => {
    expect(statesAt(1.36).planet.isActive).toBe(true);
    expect(statesAt(1.35).planet.isActive).toBe(false);
    expect(statesAt(-1.41).kelp.isActive).toBe(true);
    expect(statesAt(-1.42).kelp.isActive).toBe(false);
    expect(statesAt(-1.42).shore.isActive).toBe(false);
    expect(statesAt(-2.95).drop.isActive).toBe(true);
    expect(statesAt(-2.96).drop.isActive).toBe(false);
  });

  it('keeps the planar world at full weight below the shore’s cut, so the close-ups under it still draw', () => {
    const deep = statesAt(-3);
    expect(deep.shore.weight).toBe(1);
    expect(deep.shore.isActive).toBe(false);
  });

  it('nests the bands down the dive: shore and kelp over the planet, the drop, then the slime, then the dish', () => {
    expect(activeDiveBands(statesAt(2.3))).toEqual([DIVE_BAND.planet, DIVE_BAND.shore, DIVE_BAND.kelp]);
    expect(activeDiveBands(statesAt(-1.2))).toEqual([DIVE_BAND.shore, DIVE_BAND.kelp, DIVE_BAND.drop]);
    expect(activeDiveBands(statesAt(-2.8))).toEqual([DIVE_BAND.drop, DIVE_BAND.slime]);
    expect(activeDiveBands(statesAt(-4.3))).toEqual([DIVE_BAND.slime, DIVE_BAND.dish]);
  });

  it('crossfades the mockup’s slime into the game’s dish as the dark field arrives', () => {
    expect(statesAt(-3.7).dish.weight).toBe(0);
    expect(statesAt(-3.96).dish.weight).toBeCloseTo(0.5, 9);
    expect(statesAt(-4.22).dish.weight).toBe(1);
  });

  it('draws the game’s dish only once it is 2 px in radius', () => {
    const camera = diveCameraAt(-3.9, VIEWPORT);
    expect(DIVE_DISH_RADIUS_M * camera.pixelsPerMetre).toBeGreaterThan(2);
    expect(diveBandStates(camera).dish.isActive).toBe(true);
    const tiny = diveCameraAt(-3.75, { width: 10, height: 6 });
    expect(diveBandStates(tiny).dish.weight).toBeGreaterThan(0);
    expect(DIVE_DISH_RADIUS_M * tiny.pixelsPerMetre).toBeLessThan(2);
    expect(diveBandStates(tiny).dish.isActive).toBe(false);
  });

  it('leaves the shore out of the mockup’s canvases: the shore band draws it (ticket #801)', () => {
    expect(DIVE_MOCKUP_BAND_NAMES).toEqual(['planet', 'kelp', 'drop', 'slime']);
  });

  it('stops the slime, and with it the mockup’s whole canvas, once the view lies inside the dish', () => {
    expect(statesAt(-4.3).slime.isActive).toBe(true);
    expect(isMockupDrawing(statesAt(-4.3))).toBe(true);
    const inside = statesAt(-4.75);
    expect(inside.slime.isActive).toBe(false);
    expect(isMockupDrawing(inside)).toBe(false);
    expect(inside.dish.isActive).toBe(true);
  });
});
