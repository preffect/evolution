// The virtual pointer of the mouse lock (docs/ui/input-and-onboarding.md §4.1, #794): while the pointer is locked the
// browser reports only how far the mouse moved, so the input layer keeps its own canvas point, moves it by that
// distance and clamps it to the canvas. Pure: the adapter (`pointer-lock-input.ts`) feeds it the events.

import { POINTER_LOCK_MOVEMENT_SCALE } from './input-constants';
import type { CanvasPoint } from './input-state';

/** The canvas host's size in CSS px: the box the virtual pointer may not leave. */
export interface CanvasSize {
  readonly width: number;
  readonly height: number;
}

/** A locked pointer event's movement since the last one, in CSS px (`movementX/Y`). */
export interface PointerMovement {
  readonly movementX: number;
  readonly movementY: number;
}

function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max);
}

/** The point pulled back inside the canvas: a lock can never steer from somewhere the player cannot see. */
export function clampedToCanvas(point: CanvasPoint, size: CanvasSize): CanvasPoint {
  return { x: clamp(point.x, size.width), y: clamp(point.y, size.height) };
}

/** Where the virtual pointer is after one locked move, scaled by `POINTER_LOCK_MOVEMENT_SCALE` and clamped. */
export function virtualPointerMovedBy(point: CanvasPoint, movement: PointerMovement, size: CanvasSize): CanvasPoint {
  return clampedToCanvas(
    {
      x: point.x + movement.movementX * POINTER_LOCK_MOVEMENT_SCALE,
      y: point.y + movement.movementY * POINTER_LOCK_MOVEMENT_SCALE,
    },
    size,
  );
}
