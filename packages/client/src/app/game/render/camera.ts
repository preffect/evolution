// The camera (docs/game-design/controls-and-scope.md §7): centred on the followed cell, zoomed out as it grows, both
// smoothed client-side and purely cosmetic. Pure functions over a small state; the render loop
// owns the state and the injected clock's delta.

import {
  CAMERA_FOLLOW_SECONDS,
  CAMERA_MAX_VIEW_HALF_HEIGHT_WU,
  CAMERA_MIN_VIEW_HALF_HEIGHT_WU,
  CAMERA_VIEW_RADIUS_EXPONENT,
  CAMERA_ZOOM_SECONDS,
  DEFAULT_BALANCE,
  DISH_RADIUS,
  clamp,
  radiusForMass,
} from '@evolution/shared';
import { CAMERA_CULL_MARGIN_RADII } from './constants';
import { HALF } from './geometry';

export interface CameraState {
  /** World centre (wu). */
  readonly x: number;
  readonly y: number;
  /** Half the vertical extent of the view (wu); the vertical extent is authoritative. */
  readonly viewHalfHeightWu: number;
}

export interface CameraTarget {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

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

/** The starting cell's radius (wu) at the shipped balance: the view leaves its floor exactly there, whatever a patched room says. */
const SPAWN_RADIUS_WU = radiusForMass(DEFAULT_BALANCE.growth.CELL_STARTING_MASS, DEFAULT_BALANCE.growth);

/**
 * Z1's partial zoom (decision #324): `clamp(MIN × (radius / spawnRadius) ^ CAMERA_VIEW_RADIUS_EXPONENT, MIN, MAX)`.
 * The view grows more slowly than the cell, so a growing cell grows on screen and a shrinking one shrinks.
 */
export function viewHalfHeightFor(radius: number): number {
  const growth = (radius / SPAWN_RADIUS_WU) ** CAMERA_VIEW_RADIUS_EXPONENT;
  return clamp(CAMERA_MIN_VIEW_HALF_HEIGHT_WU * growth, CAMERA_MIN_VIEW_HALF_HEIGHT_WU, CAMERA_MAX_VIEW_HALF_HEIGHT_WU);
}

/** The view never centres outside the dish: the world ends at the wall. */
function clampToDish(x: number, y: number): { x: number; y: number } {
  const distance = Math.hypot(x, y);
  if (distance <= DISH_RADIUS) return { x, y };
  const scale = DISH_RADIUS / distance;
  return { x: x * scale, y: y * scale };
}

/** The camera parked on a target with no smoothing (spawn, a new round, a fixture). */
export function parkCamera(target: CameraTarget): CameraState {
  const centre = clampToDish(target.x, target.y);
  return { x: centre.x, y: centre.y, viewHalfHeightWu: viewHalfHeightFor(target.radius) };
}

/** Exponential smoothing: the share of the remaining distance covered in `deltaSeconds` with time constant `tau`. */
function smoothingFactor(deltaSeconds: number, tau: number): number {
  return 1 - Math.exp(-Math.max(0, deltaSeconds) / tau);
}

/** One frame of follow and zoom toward `target`; with no target the camera holds. */
export function stepCamera(state: CameraState, target: CameraTarget | null, deltaSeconds: number): CameraState {
  if (target === null) return state;
  const follow = smoothingFactor(deltaSeconds, CAMERA_FOLLOW_SECONDS);
  const zoom = smoothingFactor(deltaSeconds, CAMERA_ZOOM_SECONDS);
  const centre = clampToDish(state.x + (target.x - state.x) * follow, state.y + (target.y - state.y) * follow);
  const wanted = viewHalfHeightFor(target.radius);
  return { ...centre, viewHalfHeightWu: state.viewHalfHeightWu + (wanted - state.viewHalfHeightWu) * zoom };
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
 * Whether any part of a disc is inside the extent — no margin, so this answers "can the player see
 * it" rather than "should we draw it". The HUD's threat label anchors to a predator's warning ring
 * (docs/ui/hud.md §3.1.2, "so it is never off-screen"), and a ring that is not on screen is nothing to
 * anchor to. `isDiscInExtent` below is the draw-cull and is deliberately generous; do not reach for
 * it when the question is what the player can actually look at.
 */
export function isDiscVisibleInExtent(extent: CameraExtent, x: number, y: number, radiusWu: number): boolean {
  return (
    x + radiusWu >= extent.minX &&
    x - radiusWu <= extent.maxX &&
    y + radiusWu >= extent.minY &&
    y - radiusWu <= extent.maxY
  );
}

/** Whether a disc of `reachWu` around a centre touches the extent, with the cull margin (rendering/budget.md §6). */
export function isDiscInExtent(extent: CameraExtent, x: number, y: number, reachWu: number): boolean {
  const margin = reachWu * (1 + CAMERA_CULL_MARGIN_RADII);
  return (
    x + margin >= extent.minX && x - margin <= extent.maxX && y + margin >= extent.minY && y - margin <= extent.maxY
  );
}
