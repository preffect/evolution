// The preview canvas's bounds (docs/architecture/encyclopedia.md §12.7): the device pixel ratio it renders and
// bakes at, and the CSS size that ratio is allowed to produce. Pure arithmetic over two constants, kept out of
// `preview-session.ts` so the session is only the session.
//
// Both caps exist for the same reason: the lens's GPU buffers follow the canvas size and nothing else does. At
// `PREVIEW_CANVAS_MAX_PX` they are about 10 MiB (the colour backbuffer, the depth-stencil Pixi requests, and the
// presented front buffer), on top of the ~40 MiB bundle.

import { PREVIEW_CANVAS_MAX_PX, PREVIEW_MAX_DEVICE_PIXEL_RATIO } from '../constants';

export interface PreviewSizePx {
  readonly width: number;
  readonly height: number;
}

/**
 * The capped ratio the preview renders **and** bakes at, so a 3× display bakes 2× atlases for its 2× canvas.
 * This is the one place the cap is applied: callers hand in the display's raw ratio.
 */
export function cappedPreviewDevicePixelRatio(devicePixelRatio: number): number {
  return Math.min(devicePixelRatio, PREVIEW_MAX_DEVICE_PIXEL_RATIO);
}

/** The canvas in CSS px, each side clamped so no side exceeds `PREVIEW_CANVAS_MAX_PX` **device** pixels. */
export function clampedPreviewCanvasSize(sizePx: PreviewSizePx, cappedDevicePixelRatio: number): PreviewSizePx {
  const maximumCssPx = PREVIEW_CANVAS_MAX_PX / cappedDevicePixelRatio;
  return { width: Math.min(sizePx.width, maximumCssPx), height: Math.min(sizePx.height, maximumCssPx) };
}

/**
 * The lens's bounding square, in CSS px: the shorter side. §12.7 frames a scene against the square, so a caller
 * that ever hands in a non-square box must not have the framing bands measured against the longer dimension.
 */
export function previewLensSidePx(sizePx: PreviewSizePx): number {
  return Math.min(sizePx.width, sizePx.height);
}
