// One frame of the dive, worked out before anything draws (docs/rendering/opening-dive.md §3): the camera at the
// controls' zoom, every band's state, the planet's turn, and the frame the mockup's canvas takes. Pure, so the
// session only sequences it and the panel reads the same numbers for its readout and labels.

import type { ViewportPx } from '../camera';
import { DIVE_MAX_DEVICE_PIXEL_RATIO, DIVE_MOVING_DEVICE_PIXEL_RATIO } from '../constants';
import { diveBandStates, type DiveBandStates } from './dive-bands';
import { diveCameraAt, diveGlobeRotation, type DiveCamera } from './dive-camera';
import type { MockupFrame } from './mockup/dive-mockup-bands';

export interface DiveView {
  readonly camera: DiveCamera;
  readonly bands: DiveBandStates;
  readonly globeRotation: readonly [number, number];
  /** The ambient motion's clock: surf, drift, the cells' own motion. Still under reduced motion. */
  readonly timeSeconds: number;
  /** Whether the dive is falling this frame (the upper bands draw a little softer while it does). */
  readonly isMoving: boolean;
}

export interface DiveViewInputs {
  readonly zoom: number;
  readonly viewport: ViewportPx;
  readonly timeSeconds: number;
  readonly isMoving: boolean;
  /** How far the planet has turned on its own while the dive waited in orbit (`diveGlobeIdleSpin`). */
  readonly globeIdleSpinDegrees: number;
}

/** Two viewports of the same size: a change of size is a frame a still dive must draw. */
export function isSameViewport(first: ViewportPx, second: ViewportPx): boolean {
  return first.width === second.width && first.height === second.height;
}

export function diveViewAt(inputs: DiveViewInputs): DiveView {
  const camera = diveCameraAt(inputs.zoom, inputs.viewport);
  return {
    camera,
    bands: diveBandStates(camera),
    globeRotation: diveGlobeRotation(camera.zoom, inputs.globeIdleSpinDegrees),
    timeSeconds: inputs.timeSeconds,
    isMoving: inputs.isMoving,
  };
}

/** The upper bands' canvas resolution: the screen's (up to 2×) when still, at most 1.5× while the dive falls. */
export function mockupDevicePixelRatio(screenRatio: number, isMoving: boolean): number {
  return Math.min(screenRatio, isMoving ? DIVE_MOVING_DEVICE_PIXEL_RATIO : DIVE_MAX_DEVICE_PIXEL_RATIO);
}

/** What the mockup's canvas draws this frame, the baked planet at `globeAlpha` over the fallback globe. */
export function mockupFrameOf(view: DiveView, screenRatio: number, globeAlpha: number): MockupFrame {
  return {
    zoom: view.camera.zoom,
    timeSeconds: view.timeSeconds,
    widthPx: view.camera.viewport.width,
    heightPx: view.camera.viewport.height,
    devicePixelRatio: mockupDevicePixelRatio(screenRatio, view.isMoving),
    globeRotation: view.globeRotation,
    bands: view.bands,
    globeAlpha,
  };
}
