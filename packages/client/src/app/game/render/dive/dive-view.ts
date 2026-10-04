// One frame of the dive, worked out before anything draws (docs/rendering/opening-dive.md §3): the camera at the
// controls' zoom, every band's state and the planet's turn. Pure, so the session only sequences it and the panel reads
// the same numbers for its readout and labels.

import type { ViewportPx } from '../camera';
import { DIVE_MAX_DEVICE_PIXEL_RATIO, DIVE_MOVING_DEVICE_PIXEL_RATIO } from '../constants';
import { diveBandStates, type DiveBandStates } from './dive-bands';
import { diveCameraAt, diveGlobeRotation, type DiveCamera } from './dive-camera';

export interface DiveView {
  readonly camera: DiveCamera;
  readonly bands: DiveBandStates;
  readonly globeRotation: readonly [number, number];
  /** The ambient motion's clock: surf, drift, the cells' own motion. Still under reduced motion. */
  readonly timeSeconds: number;
  /** Whether the dive is falling this frame (the upper bands draw a little softer while it does). */
  readonly isMoving: boolean;
  /** The slime band's pictures have landed: the labels that name them show (ticket #803). */
  readonly hasSlimePictures: boolean;
  /**
   * Device px per css px the dive canvas renders this frame at, as the resolution governor set it (ticket #804): the
   * shaders judge their coverage and their least sizes in these px.
   */
  readonly deviceRatio: number;
}

/** What every band's frame starts with (`kelp-frame.ts`, `slime-frame.ts`): the stage, its scale, zoom and clock. */
export interface DiveStageFrame {
  readonly stageWidthPx: number;
  readonly stageHeightPx: number;
  /** Css px per metre (the mockup's `s`). */
  readonly pixelsPerMetre: number;
  readonly zoom: number;
  readonly timeSeconds: number;
}

export interface DiveViewInputs {
  readonly zoom: number;
  readonly viewport: ViewportPx;
  readonly timeSeconds: number;
  readonly isMoving: boolean;
  /** How far the planet has turned on its own while the dive waited in orbit (`diveGlobeIdleSpin`). */
  readonly globeIdleSpinDegrees: number;
  /** The slime band's pictures have landed (absent: they have). */
  readonly hasSlimePictures?: boolean;
  /** The canvas's device px per css px this frame (absent: 1). */
  readonly deviceRatio?: number;
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
    hasSlimePictures: inputs.hasSlimePictures ?? true,
    deviceRatio: inputs.deviceRatio ?? 1,
  };
}

/** The upper bands' resolution cap: the screen's (up to 2×) when still, at most 1.5× while the dive falls. */
export function upperBandsDevicePixelRatio(screenRatio: number, isMoving: boolean): number {
  return Math.min(screenRatio, isMoving ? DIVE_MOVING_DEVICE_PIXEL_RATIO : DIVE_MAX_DEVICE_PIXEL_RATIO);
}
