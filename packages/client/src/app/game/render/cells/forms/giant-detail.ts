// The detail a form gains at giant size (docs/ecology/giants.md §3.5.11, docs/visual-style/cells-and-organelles.md §4.1):
// the paramecium's oral groove and mouth, the contractile vacuoles of the paramecium and the amoeba, and the giant
// diatom's rings of pores. This file is the TypeScript reference; `cell-shader-giants.ts` paints the same marks term
// for term. Points are in the heading frame (+x the heading) in membrane radii, so they ride the outline's deformation.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import {
  GIANT_DIATOM_RING_PORE_SPACING_RADII,
  GIANT_ORAL_GROOVE_BOW_RADII,
  GIANT_ORAL_GROOVE_END,
  GIANT_ORAL_GROOVE_START_RADII,
  GIANT_VACUOLE_CYCLE_SECONDS,
  GIANT_VACUOLE_EMPTY_SCALE,
  GIANT_VACUOLE_FILL_SHARE,
  SLIPPER_ORAL_GROOVE_DEG,
} from '../../constants';
import { HALF, degreesToRadians, wrapAngle, wrapUnit } from '../../geometry';

export interface HeadingPoint {
  readonly x: number;
  readonly y: number;
}

/** The groove as a circular arc: its centre and radius (membrane radii) and the angles of its notch and mouth ends. */
export interface GrooveArc {
  readonly centre: HeadingPoint;
  readonly radius: number;
  readonly notchAngle: number;
  /** The arc's signed sweep from the notch end to the mouth end, radians. */
  readonly sweep: number;
}

/** Where the groove leaves the outline's notch, just inside the membrane. */
export const ORAL_GROOVE_START: HeadingPoint = {
  x: GIANT_ORAL_GROOVE_START_RADII * Math.cos(degreesToRadians(SLIPPER_ORAL_GROOVE_DEG)),
  y: GIANT_ORAL_GROOVE_START_RADII * Math.sin(degreesToRadians(SLIPPER_ORAL_GROOVE_DEG)),
};

/**
 * The arc through the notch end and the mouth that bows `GIANT_ORAL_GROOVE_BOW_RADII` off its chord toward the ventral
 * side (+y, the notch's side): radius `(c²/4 + h²) / 2h` for a chord `c` and a bow `h`.
 */
export function oralGrooveArc(): GrooveArc {
  const start = ORAL_GROOVE_START;
  const end = GIANT_ORAL_GROOVE_END;
  const chordX = end.x - start.x;
  const chordY = end.y - start.y;
  const chord = Math.hypot(chordX, chordY);
  const bow = GIANT_ORAL_GROOVE_BOW_RADII;
  const radius = (chord * chord * HALF * HALF + bow * bow) / (bow + bow);
  const ventral = chordX > 0 ? { x: -chordY / chord, y: chordX / chord } : { x: chordY / chord, y: -chordX / chord };
  const back = radius - bow;
  const centre = {
    x: (start.x + end.x) * HALF - ventral.x * back,
    y: (start.y + end.y) * HALF - ventral.y * back,
  };
  const notchAngle = Math.atan2(start.y - centre.y, start.x - centre.x);
  const mouthAngle = Math.atan2(end.y - centre.y, end.x - centre.x);
  return { centre, radius, notchAngle, sweep: wrapAngle(mouthAngle - notchAngle) };
}

/** How far along the groove `point` lies, 0 at the notch and 1 at the mouth; outside [0, 1] off either end. */
export function grooveShare(arc: GrooveArc, point: HeadingPoint): number {
  const angle = Math.atan2(point.y - arc.centre.y, point.x - arc.centre.x);
  return wrapAngle(angle - arc.notchAngle) / arc.sweep;
}

/** A contractile vacuole's radius scale over its cycle: it swells slowly to full, then empties at once. */
export function vacuoleScale(timeSeconds: number, phase: number): number {
  const cycle = wrapUnit(timeSeconds / GIANT_VACUOLE_CYCLE_SECONDS + phase);
  const share =
    cycle < GIANT_VACUOLE_FILL_SHARE
      ? cycle / GIANT_VACUOLE_FILL_SHARE
      : 1 - (cycle - GIANT_VACUOLE_FILL_SHARE) / (1 - GIANT_VACUOLE_FILL_SHARE);
  return GIANT_VACUOLE_EMPTY_SCALE + (1 - GIANT_VACUOLE_EMPTY_SCALE) * share;
}

/** How full the collecting canals are: brimming while the vacuole is empty, drained as it swells (0 → 1). */
export function canalFullness(scale: number): number {
  return 1 - (scale - GIANT_VACUOLE_EMPTY_SCALE) / (1 - GIANT_VACUOLE_EMPTY_SCALE);
}

/** The pores round one ring of the valve, `ringRadii` out: one every `GIANT_DIATOM_RING_PORE_SPACING_RADII`. */
export function ringPoreCount(ringRadii: number): number {
  return Math.floor((RADIANS_PER_FULL_TURN * ringRadii) / GIANT_DIATOM_RING_PORE_SPACING_RADII);
}
