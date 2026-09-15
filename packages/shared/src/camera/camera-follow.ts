// The camera's follow and zoom (docs/game-design/controls-and-scope.md §7): centred on the followed cell, its view
// growing with √radius under Z1's partial zoom (decision #324), both smoothed. One home for both sides: the client
// renders through it and the server runs the same camera per viewer to cull what that viewer is sent
// (docs/architecture/wire-contract.md §4.2 lever 1), so the cull area follows exactly the view the client draws.
// Pure over a small state.

import {
  CAMERA_FOLLOW_SECONDS,
  CAMERA_MAX_VIEW_HALF_HEIGHT_WU,
  CAMERA_MIN_VIEW_HALF_HEIGHT_WU,
  CAMERA_VIEW_RADIUS_EXPONENT,
  CAMERA_ZOOM_SECONDS,
} from '../constants/camera.js';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { DISH_RADIUS } from '../constants/world.js';
import { radiusForMass } from '../simulation/mass-curves.js';
import { clamp, type EntityId, type PlayerId } from '../types/common.js';

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

/** A cell as the camera reads it: a view on the client, a record on the server. */
export interface FollowableCell {
  readonly id: EntityId;
  readonly playerId: PlayerId | null;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/** Where the camera parks before anyone exists to follow: the dish centre at a unit radius. */
export const DISH_CENTRE_TARGET: CameraTarget = { x: 0, y: 0, radius: 1 };

/** The starting cell's radius (wu) at the shipped balance: the view leaves its floor exactly there, whatever a patched room says. */
const SPAWN_RADIUS_WU = radiusForMass(DEFAULT_BALANCE.growth.CELL_STARTING_MASS, DEFAULT_BALANCE.growth);

/**
 * Whom the camera follows (docs/game-design/controls-and-scope.md §7): the player's own cell while alive, the killer's
 * cell while spectating, nothing when neither exists.
 */
export function followTargetIn(
  cells: readonly FollowableCell[],
  playerId: PlayerId,
  spectatingCellId: EntityId | null,
): CameraTarget | null {
  const own = cells.find((cell) => cell.playerId === playerId);
  if (own !== undefined) return { x: own.x, y: own.y, radius: own.radius };
  const killer = spectatingCellId === null ? undefined : cells.find((cell) => cell.id === spectatingCellId);
  return killer === undefined ? null : { x: killer.x, y: killer.y, radius: killer.radius };
}

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

/** One step of follow and zoom toward `target`; with no target the camera holds. */
export function stepCamera(state: CameraState, target: CameraTarget | null, deltaSeconds: number): CameraState {
  if (target === null) return state;
  const follow = smoothingFactor(deltaSeconds, CAMERA_FOLLOW_SECONDS);
  const zoom = smoothingFactor(deltaSeconds, CAMERA_ZOOM_SECONDS);
  const centre = clampToDish(state.x + (target.x - state.x) * follow, state.y + (target.y - state.y) * follow);
  const wanted = viewHalfHeightFor(target.radius);
  return { ...centre, viewHalfHeightWu: state.viewHalfHeightWu + (wanted - state.viewHalfHeightWu) * zoom };
}
