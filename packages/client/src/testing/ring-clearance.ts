// Measuring a traced ring against its membrane (#730): both curves sampled as closed polylines, and the clearance the
// true least distance between them, so a ring that pinched a flank or cut a tip reads short whatever its formula says.

import { evaluateProfile, type RadialProfileTerms } from '../app/game/render/cells/radial-profile';
import { tracedRingAt, type TracedRing } from '../app/game/render/cells/traced-ring';

export type Point = readonly [number, number];

const MEMBRANE_SAMPLES = 2048;
const RING_SAMPLES = 512;
/** Wider than any angle a gap subtends at the ring (a 0.3 r gap at 1.3 r is 0.23 rad). */
const NEAREST_WINDOW_RAD = 0.6;

/** `count` points of the closed curve `r(θ)`, evenly in θ from −π. */
export function polyline(radiusAt: (theta: number) => number, count = RING_SAMPLES): Point[] {
  return Array.from({ length: count }, (_unused, index) => {
    const theta = -Math.PI + (index / count) * 2 * Math.PI;
    const radius = radiusAt(theta);
    return [radius * Math.cos(theta), radius * Math.sin(theta)] as const;
  });
}

function segmentDistance(point: Point, start: Point, end: Point): number {
  const [deltaX, deltaY] = [end[0] - start[0], end[1] - start[1]];
  const along = ((point[0] - start[0]) * deltaX + (point[1] - start[1]) * deltaY) / (deltaX * deltaX + deltaY * deltaY);
  const share = Math.min(Math.max(along, 0), 1);
  return Math.hypot(start[0] + share * deltaX - point[0], start[1] + share * deltaY - point[1]);
}

/**
 * The least distance from any point of `ring` to the closed polyline `membrane` (sampled evenly in θ from −π): only the
 * segments within `NEAREST_WINDOW_RAD` of the point's angle can be nearest, since the curves are a gap apart.
 */
export function clearance(ring: readonly Point[], membrane: readonly Point[]): number {
  const window = Math.ceil((NEAREST_WINDOW_RAD / (2 * Math.PI)) * membrane.length);
  let least = Infinity;
  for (const point of ring) {
    const centre = Math.round(((Math.atan2(point[1], point[0]) + Math.PI) / (2 * Math.PI)) * membrane.length);
    for (let offset = -window; offset <= window; offset += 1) {
      const index = (centre + offset + membrane.length) % membrane.length;
      const next = membrane[(index + 1) % membrane.length] ?? point;
      least = Math.min(least, segmentDistance(point, membrane[index] ?? point, next));
    }
  }
  return least;
}

export function membraneOf(terms: RadialProfileTerms): Point[] {
  return polyline((theta) => evaluateProfile(terms, theta).r, MEMBRANE_SAMPLES);
}

export function ringPolyline(ring: TracedRing): Point[] {
  return polyline((theta) => tracedRingAt(ring, theta).r);
}
