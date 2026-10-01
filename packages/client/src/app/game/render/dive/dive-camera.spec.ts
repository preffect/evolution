// @vitest-environment node
// The log-zoom camera (docs/rendering/opening-dive.md §2): the zoom is log10 of the view's width in metres, every
// band draws in metres round the focus, and the game's renderer gets the same scale in px per world unit.

import { DISH_RADIUS } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { DIVE_DISH_DIAMETER_M, DIVE_FOCUS_DEGREES, DIVE_ZOOM_BOTTOM, DIVE_ZOOM_TOP } from '../constants';
import {
  DIVE_SLIDER_MAX,
  clampDiveZoom,
  diveCameraAt,
  diveGlobeRotation,
  diveRendererZoom,
  diveScreenPoint,
  diveSliderPercent,
  diveSliderValue,
  diveViewReachM,
  diveZoomFromSlider,
} from './dive-camera';

const VIEWPORT = { width: 1000, height: 500 };
const DIGITS = 9;

describe('diveCameraAt', () => {
  it('spans 10^zoom metres across the view: 1 km over 1000 px is 1 px a metre', () => {
    const camera = diveCameraAt(3, VIEWPORT);
    expect(camera.pixelsPerMetre).toBeCloseTo(1, DIGITS);
    expect(camera.halfWidthM).toBeCloseTo(500, DIGITS);
    expect(camera.halfHeightM).toBeCloseTo(250, DIGITS);
  });

  it('is ten times closer one zoom step down', () => {
    const near = diveCameraAt(-4, VIEWPORT);
    const far = diveCameraAt(-3, VIEWPORT);
    expect(near.pixelsPerMetre / far.pixelsPerMetre).toBeCloseTo(10, DIGITS);
  });

  it('keeps the zoom to the dive: orbit at the top, inside your cell at the bottom', () => {
    expect(clampDiveZoom(99)).toBe(DIVE_ZOOM_TOP);
    expect(clampDiveZoom(-99)).toBe(DIVE_ZOOM_BOTTOM);
    expect(diveCameraAt(99, VIEWPORT).zoom).toBe(DIVE_ZOOM_TOP);
  });

  it('scales by nothing over a view with no width, rather than dividing by zero', () => {
    const camera = diveCameraAt(0, { width: 0, height: 0 });
    expect(camera.pixelsPerMetre).toBe(0);
    expect(camera.halfWidthM).toBe(0);
  });
});

describe('diveScreenPoint', () => {
  it('puts the focus at the view centre and a metre east a px-per-metre to its right', () => {
    const camera = diveCameraAt(3, VIEWPORT);
    expect(diveScreenPoint(camera, { x: 0, y: 0 })).toEqual({ x: 500, y: 250 });
    expect(diveScreenPoint(camera, { x: 10, y: -20 })).toEqual({ x: 510, y: 230 });
  });
});

describe('diveRendererZoom', () => {
  it('draws the game dish (DISH_RADIUS wu) exactly as wide as the 40 µm pocket', () => {
    const camera = diveCameraAt(-4.3, VIEWPORT);
    const dishWidthPx = 2 * DISH_RADIUS * diveRendererZoom(camera);
    expect(dishWidthPx).toBeCloseTo(DIVE_DISH_DIAMETER_M * camera.pixelsPerMetre, DIGITS);
  });
});

describe('diveViewReachM', () => {
  it('is half the view diagonal', () => {
    expect(diveViewReachM(diveCameraAt(3, { width: 600, height: 800 }))).toBeCloseTo(Math.hypot(500, 2000 / 3), DIGITS);
  });
});

describe('diveGlobeRotation', () => {
  it('looks over Eurasia at the top and at the focus once the turn is done', () => {
    expect(diveGlobeRotation(DIVE_ZOOM_TOP)).toEqual([-82, -38]);
    const turned = diveGlobeRotation(6);
    expect(turned[0]).toBeCloseTo(-(360 + DIVE_FOCUS_DEGREES.longitude), DIGITS);
    expect(turned[1]).toBeCloseTo(-DIVE_FOCUS_DEGREES.latitude, DIGITS);
  });

  it('turns smoothly through the window: halfway at its middle', () => {
    const [longitude] = diveGlobeRotation(7.3 - 0.55 / 2);
    expect(-longitude).toBeCloseTo((82 + 360 + DIVE_FOCUS_DEGREES.longitude) / 2, DIGITS);
  });
});

describe('the slider', () => {
  it('runs from Earth on the left (0) to your cell on the right', () => {
    expect(diveSliderValue(DIVE_ZOOM_TOP)).toBe(0);
    expect(diveSliderValue(DIVE_ZOOM_BOTTOM)).toBeCloseTo(DIVE_SLIDER_MAX, DIGITS);
    expect(diveSliderPercent(DIVE_ZOOM_BOTTOM)).toBeCloseTo(100, DIGITS);
  });

  it('turns a slider value back into the zoom it shows', () => {
    for (const zoom of [7.3, 1.1, -4.3]) expect(diveZoomFromSlider(diveSliderValue(zoom))).toBeCloseTo(zoom, DIGITS);
  });
});
