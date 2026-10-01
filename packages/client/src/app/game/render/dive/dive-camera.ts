// The dive's log-zoom camera (docs/rendering/opening-dive.md §2): one focus point, one zoom — log10 of the view's
// width in metres — and from those the scale every band draws at. Bands draw in metres around the focus (x east,
// y south); the game's renderer draws in world units, `DIVE_METRES_PER_WU` of them to the metre.

import type { ViewportPx } from '../camera';
import {
  DIVE_FOCUS_DEGREES,
  DIVE_GLOBE_START_DEGREES,
  DIVE_GLOBE_TURN_SPAN_ZOOM,
  DIVE_GLOBE_TURN_START_ZOOM,
  DIVE_METRES_PER_WU,
  DIVE_ZOOM_BASE,
  DIVE_ZOOM_BOTTOM,
  DIVE_ZOOM_TOP,
} from '../constants';
import { DEGREES_PER_TURN, HALF, clamp01, smoothstep } from '../geometry';

export interface DiveCamera {
  /** log10 of the view's width in metres. */
  readonly zoom: number;
  readonly viewport: ViewportPx;
  /** CSS px per metre (the mockup's `s`). */
  readonly pixelsPerMetre: number;
  /** Half the view's width and height in metres (`hx`, `hy`). */
  readonly halfWidthM: number;
  readonly halfHeightM: number;
}

/** A point in metres around the focus. */
export interface DivePoint {
  readonly x: number;
  readonly y: number;
}

/** The zoom kept to the dive's range: the top (orbit) to the bottom (inside your cell). */
export function clampDiveZoom(zoom: number): number {
  return Math.min(DIVE_ZOOM_TOP, Math.max(DIVE_ZOOM_BOTTOM, zoom));
}

/** The camera at `zoom` over `viewport`; a viewport with no width draws nothing and scales by nothing. */
export function diveCameraAt(zoom: number, viewport: ViewportPx): DiveCamera {
  const clamped = clampDiveZoom(zoom);
  const pixelsPerMetre = viewport.width / Math.pow(DIVE_ZOOM_BASE, clamped);
  const metresPerPixel = pixelsPerMetre > 0 ? 1 / pixelsPerMetre : 0;
  return {
    zoom: clamped,
    viewport,
    pixelsPerMetre,
    halfWidthM: viewport.width * HALF * metresPerPixel,
    halfHeightM: viewport.height * HALF * metresPerPixel,
  };
}

/** Where a point in metres around the focus lands on screen, in CSS px from the top-left. */
export function diveScreenPoint(camera: DiveCamera, point: DivePoint): DivePoint {
  return {
    x: camera.viewport.width * HALF + point.x * camera.pixelsPerMetre,
    y: camera.viewport.height * HALF + point.y * camera.pixelsPerMetre,
  };
}

/** The game renderer's zoom at this camera: CSS px per world unit. */
export function diveRendererZoom(camera: DiveCamera): number {
  return camera.pixelsPerMetre * DIVE_METRES_PER_WU;
}

/** Half the view's diagonal in metres: the view lies inside any disc round the focus wider than this. */
export function diveViewReachM(camera: DiveCamera): number {
  return Math.hypot(camera.halfWidthM, camera.halfHeightM);
}

/** The planet's rotation as d3 takes it, `[λ, φ]` degrees: over Eurasia at the top, turned to the focus below. */
export function diveGlobeRotation(zoom: number): readonly [number, number] {
  const turn = smoothstep(0, 1, clamp01((DIVE_GLOBE_TURN_START_ZOOM - zoom) / DIVE_GLOBE_TURN_SPAN_ZOOM));
  const endLongitude = DEGREES_PER_TURN + DIVE_FOCUS_DEGREES.longitude;
  const longitude = DIVE_GLOBE_START_DEGREES.longitude + (endLongitude - DIVE_GLOBE_START_DEGREES.longitude) * turn;
  const latitude =
    DIVE_GLOBE_START_DEGREES.latitude + (DIVE_FOCUS_DEGREES.latitude - DIVE_GLOBE_START_DEGREES.latitude) * turn;
  return [-longitude, -latitude];
}

/** The slider runs from Earth (left, 0) to your cell (right): its value is how far below the top the zoom is. */
export function diveSliderValue(zoom: number): number {
  return DIVE_ZOOM_TOP - clampDiveZoom(zoom);
}

export function diveZoomFromSlider(value: number): number {
  return clampDiveZoom(DIVE_ZOOM_TOP - value);
}

const PERCENT = 100;

/** The slider's full travel. */
export const DIVE_SLIDER_MAX = DIVE_ZOOM_TOP - DIVE_ZOOM_BOTTOM;

/** Where a zoom sits along the slider, in percent of its travel (the tick marks and phase markers). */
export function diveSliderPercent(zoom: number): number {
  return (diveSliderValue(zoom) / DIVE_SLIDER_MAX) * PERCENT;
}
