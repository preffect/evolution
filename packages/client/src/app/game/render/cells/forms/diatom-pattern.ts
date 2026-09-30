// The diatom's valve pattern (#195; docs/rendering/cells.md §2.4, sheet 04 diatom): `DIATOM_STRIA_COUNT` radial striae
// from the central area to just inside the margin, alternating a bold rib and a fine stria, with a row of pores along
// every fine one. It lies in the body frame turned with the heading, so the rigid shell turns as one piece with its
// spines. Line widths are screen px (a hairline at any size), the pores radii with a px floor. This file is the
// TypeScript reference; `cell-shader-diatom.ts` paints the same marks term for term, feathered.

import { RADIANS_PER_FULL_TURN, clamp } from '@evolution/shared';
import {
  DIATOM_FINE_STRIA_WIDTH_PX,
  DIATOM_PORE_FIRST_RADII,
  DIATOM_PORE_MIN_PX,
  DIATOM_PORE_RADIUS_RADII,
  DIATOM_PORE_ROWS,
  DIATOM_PORE_SPACING_RADII,
  DIATOM_RIB_WIDTH_PX,
  DIATOM_STRIA_COUNT,
  DIATOM_STRIA_INNER_RADII,
  DIATOM_STRIA_OUTER_RADII,
} from '../../constants';
import { HALF } from '../../geometry';

/** Spokes of each kind: the ribs and, half a spoke round from each, the fine striae. */
export const DIATOM_RIB_COUNT = DIATOM_STRIA_COUNT * HALF;
/** The fine striae sit half a rib spacing round from the ribs. */
export const DIATOM_FINE_STRIA_TURN = HALF / DIATOM_RIB_COUNT;
/** The furthest pore row from the centre. */
export const DIATOM_PORE_LAST_RADII = DIATOM_PORE_FIRST_RADII + (DIATOM_PORE_ROWS - 1) * DIATOM_PORE_SPACING_RADII;

/** A point in the valve's frame: body-frame radii, turned so +x is the heading. */
export interface ValvePoint {
  readonly x: number;
  readonly y: number;
}

export type ValveMark = 'rib' | 'fine' | 'pore';

/**
 * Screen-px distance from the nearest of `count` spokes at `angle`, `radiusPx` out: the spokes sit at (k + ½) / count
 * turns (the shader's `spokeDistancePx`).
 */
export function spokeDistancePx(count: number, angle: number, radiusPx: number): number {
  const turns = (count * angle) / RADIANS_PER_FULL_TURN;
  return (Math.abs(turns - Math.floor(turns) - HALF) * RADIANS_PER_FULL_TURN * radiusPx) / count;
}

/** The pore nearest `point` on the fine stria nearest it, in the valve's frame. */
export function nearestPore(point: ValvePoint): ValvePoint {
  const angle = Math.atan2(point.y, point.x) - DIATOM_FINE_STRIA_TURN * RADIANS_PER_FULL_TURN;
  const spacing = RADIANS_PER_FULL_TURN / DIATOM_RIB_COUNT;
  const striaAngle = (Math.floor(angle / spacing) + HALF) * spacing + DIATOM_FINE_STRIA_TURN * RADIANS_PER_FULL_TURN;
  const rho = Math.hypot(point.x, point.y);
  const row = clamp(Math.round((rho - DIATOM_PORE_FIRST_RADII) / DIATOM_PORE_SPACING_RADII), 0, DIATOM_PORE_ROWS - 1);
  const out = DIATOM_PORE_FIRST_RADII + row * DIATOM_PORE_SPACING_RADII;
  return { x: out * Math.cos(striaAngle), y: out * Math.sin(striaAngle) };
}

/**
 * The mark the valve paints at `point` on a cell `radiusPx` px in radius, if any: a pore over a stria over a rib, the
 * striae only between the central area and the margin.
 */
export function valveMarkAt(point: ValvePoint, radiusPx: number): ValveMark | null {
  const pore = nearestPore(point);
  const poreRadii = Math.max(DIATOM_PORE_RADIUS_RADII, (DIATOM_PORE_MIN_PX * HALF) / radiusPx);
  if (Math.hypot(point.x - pore.x, point.y - pore.y) <= poreRadii) return 'pore';
  const rho = Math.hypot(point.x, point.y);
  if (rho < DIATOM_STRIA_INNER_RADII || rho > DIATOM_STRIA_OUTER_RADII) return null;
  const angle = Math.atan2(point.y, point.x);
  const fineAngle = angle - DIATOM_FINE_STRIA_TURN * RADIANS_PER_FULL_TURN;
  if (spokeDistancePx(DIATOM_RIB_COUNT, fineAngle, rho * radiusPx) <= DIATOM_FINE_STRIA_WIDTH_PX * HALF) return 'fine';
  if (spokeDistancePx(DIATOM_RIB_COUNT, angle, rho * radiusPx) <= DIATOM_RIB_WIDTH_PX * HALF) return 'rib';
  return null;
}
