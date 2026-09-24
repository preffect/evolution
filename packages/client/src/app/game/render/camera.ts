// The camera (docs/game-design/controls-and-scope.md §7): centred on the followed cell, zoomed out as it grows, both
// smoothed and purely cosmetic. The follow, the zoom and Z1's view half-height are shared (`@evolution/shared`,
// `camera/camera-follow.ts`), because the server runs the same camera per viewer to cull its snapshots; this file adds
// what only a screen has: the viewport, the projections and the draw cull. The render loop owns the state and the
// injected clock's delta.

import type { CameraState } from '@evolution/shared';
import { HALF } from './geometry';

export interface ViewportPx {
  readonly width: number;
  readonly height: number;
}

/** A world-space rectangle (wu). */
export interface CameraExtent {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Two extents that describe the same rectangle; a fresh object per frame is not a new view. */
export function isSameCameraExtent(first: CameraExtent | null, second: CameraExtent | null): boolean {
  if (first === second) return true;
  if (first === null || second === null) return false;
  return (
    first.minX === second.minX && first.maxX === second.maxX && first.minY === second.minY && first.maxY === second.maxY
  );
}

/** A point in screen px. */
export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/** A point in world units (wu). */
export interface WorldPoint {
  readonly x: number;
  readonly y: number;
}

/** CSS px per wu. */
export function zoomFor(state: CameraState, viewport: ViewportPx): number {
  return (viewport.height * HALF) / state.viewHalfHeightWu;
}

export function cameraExtent(state: CameraState, viewport: ViewportPx): CameraExtent {
  const halfHeight = state.viewHalfHeightWu;
  const halfWidth = viewport.height > 0 ? (halfHeight * viewport.width) / viewport.height : halfHeight;
  return {
    minX: state.x - halfWidth,
    maxX: state.x + halfWidth,
    minY: state.y - halfHeight,
    maxY: state.y + halfHeight,
  };
}

export function worldToScreen(state: CameraState, viewport: ViewportPx, x: number, y: number): ScreenPoint {
  const zoom = zoomFor(state, viewport);
  return { x: (x - state.x) * zoom + viewport.width * HALF, y: (y - state.y) * zoom + viewport.height * HALF };
}

/**
 * A screen point as a world-space offset from the middle of the view: what a caller anchors to
 * something other than the camera's own centre. The steer target hangs the pointer off the newest
 * snapshot's own cell this way, because the smoothed, interpolated camera trails it (docs/ui/input-and-onboarding.md §4).
 */
export function screenOffsetToWorld(state: CameraState, viewport: ViewportPx, x: number, y: number): WorldPoint {
  const zoom = zoomFor(state, viewport);
  return { x: (x - viewport.width * HALF) / zoom, y: (y - viewport.height * HALF) / zoom };
}

export function screenToWorld(state: CameraState, viewport: ViewportPx, x: number, y: number): WorldPoint {
  const offset = screenOffsetToWorld(state, viewport, x, y);
  return { x: state.x + offset.x, y: state.y + offset.y };
}

/**
 * Whether any part of a disc is inside the extent, with no margin. The HUD asks it of what the player can see (the
 * threat label anchors to a predator's warning ring, docs/ui/hud.md §3.1.2, and an off-screen ring is nothing to
 * anchor to); the cell layer's cull asks it of the widest a cell can draw (`cells/cell-cull.ts`, ticket #529), which
 * is already the whole drawing, so neither needs a margin.
 */
export function isDiscVisibleInExtent(extent: CameraExtent, x: number, y: number, radiusWu: number): boolean {
  return (
    x + radiusWu >= extent.minX &&
    x - radiusWu <= extent.maxX &&
    y + radiusWu >= extent.minY &&
    y - radiusWu <= extent.maxY
  );
}
