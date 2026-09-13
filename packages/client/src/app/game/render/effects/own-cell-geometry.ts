// The own-cell indicators' geometry (docs/RENDERING.md §10, docs/UI.md §3.1.2–§3.1.3): the floored
// radii every indicator sits on and the one turn from the record's angles to the screen, as px in
// the own cell's undeformed screen frame (offsets from its centre, y down). The ladder orbit's
// layout (`orbit-layout.ts`) is built on these; the drawing computes no geometry of its own.
//
// The record's angles are degrees **clockwise from 12 o'clock** (UI.md §3.1.2). The screen measures
// radians from 3 o'clock toward +y, which on a y-down screen is also clockwise, so the one turn
// between the two is a quarter turn back: `screenRadiansOf`. A sprite laid along the orbit is a
// further quarter turn on from its radius (`OrbitPoint.rotation`). Both are pinned against the §9
// angles in the spec, because a wrong turn moves a counter with every constant still reading right.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import {
  DNA_RING_MIN_RADIUS_PX,
  DNA_RING_RADIUS_FRACTION,
  LADDER_BACKING_PX,
  LADDER_GHOST_PX,
  LADDER_ORBIT_GAP_PX,
  LADDER_UNLOCK_RING_PAD_PX,
  SEAT_MARK_BEAD_MIN_PX,
  SEAT_MARK_BEAD_RADIUS_FRACTION,
  SEAT_MARK_HALO_SCALE,
  SELF_RING_MIN_PX,
  SELF_RING_RADIUS_FRACTION,
} from '../constants';
import { DEGREES_PER_TURN, HALF, degreesToRadians } from '../geometry';

/** 12 o'clock sits a quarter turn counter-clockwise of the screen's zero at 3 o'clock. */
const QUARTER_TURN_DEG = 90;

/** A point on the orbit: its angle (clockwise from 12), its px offset from the cell centre, its tangent. */
export interface OrbitPoint {
  readonly angleDeg: number;
  readonly x: number;
  readonly y: number;
  /** Screen radians of the tangent there, clockwise: a sprite's long axis lies along the orbit. */
  readonly rotation: number;
}

/** The nucleus halo's radius with its floor: two digits of the numeral fit inside at the floor. */
export function dnaRingRadiusPx(rPx: number): number {
  return Math.max(DNA_RING_RADIUS_FRACTION * rPx, DNA_RING_MIN_RADIUS_PX);
}

/** VISUAL-STYLE §2's identity ring, the same rule `cell-shader-membrane.ts` draws it by. */
export function selfRingRadiusPx(rPx: number): number {
  return Math.max(SELF_RING_RADIUS_FRACTION * rPx, SELF_RING_MIN_PX);
}

export function ladderOrbitRadiusPx(rPx: number): number {
  return selfRingRadiusPx(rPx) + LADDER_ORBIT_GAP_PX;
}

/** A full counter's level-gold ring around its ghost: `LADDER_UNLOCK_RING_PAD_PX` outside the ghost's square. */
export function unlockRingRadiusPx(): number {
  return LADDER_GHOST_PX * HALF + LADDER_UNLOCK_RING_PAD_PX;
}

/** The outer edge of the orbit's backing: what the picker band and the threat label keep clear of. */
export function ladderOrbitExtentPx(rPx: number): number {
  return ladderOrbitRadiusPx(rPx) + LADDER_BACKING_PX * HALF;
}

/** The seat mark's bead halo, the same rule `cell-shader-membrane.ts` draws it by (VISUAL-STYLE §2). */
export function seatMarkHaloPx(rPx: number): number {
  return SEAT_MARK_HALO_SCALE * Math.max(SEAT_MARK_BEAD_RADIUS_FRACTION * rPx, SEAT_MARK_BEAD_MIN_PX);
}

/** Screen radians (from 3 o'clock, clockwise on a y-down screen) of an angle clockwise from 12 o'clock. */
export function screenRadiansOf(angleDeg: number): number {
  return degreesToRadians(angleDeg - QUARTER_TURN_DEG);
}

export function orbitPointPx(radiusPx: number, angleDeg: number): OrbitPoint {
  const radians = screenRadiansOf(angleDeg);
  return {
    angleDeg,
    x: Math.cos(radians) * radiusPx,
    y: Math.sin(radians) * radiusPx,
    rotation: screenRadiansOf(angleDeg + QUARTER_TURN_DEG),
  };
}

/** A px length along the orbit as degrees of it. */
export function orbitDegreesOf(lengthPx: number, radiusPx: number): number {
  return (lengthPx / radiusPx) * (DEGREES_PER_TURN / RADIANS_PER_FULL_TURN);
}
