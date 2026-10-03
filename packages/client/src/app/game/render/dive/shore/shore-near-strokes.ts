// Wide strokes along the coast, near the view only (docs/rendering/opening-dive.md §4, ticket #801, the mockup's
// `nearRuns`, `runsPath`, `strokeNearPath` and `offsetRings`). A stroke of half-width w paints the view only from
// segments within w of it, and with round joins and caps the runs that pass that test paint exactly the same pixels.
// The runs are thinned too (radial decimation at a few percent of the width, never under a pixel), keeping a vertex
// each time the arc length passes a multiple of the tolerance, so a thinned edge never shimmers from one level to the
// next.

import { SHORE_NEAR_STROKE } from '../../constants/dive-shore';
import { pxToMetres, type ShorePaint } from './shore-paint';
import { DIAMETER_PER_RADIUS } from '../../geometry';
import { POINT_STRIDE, isOutside, pointCount, pointX, pointY, segmentBox, type MetreBox } from './shore-points';

/** A polyline needs two points to have a segment. */
const MIN_POLYLINE_POINTS = 2;

/** A polyline as the coast's rings are: flat `[x, y, …]`. */
export type Polyline = readonly number[] | Float64Array;

interface Run {
  readonly points: number[];
  /** Arc length along the whole ring at the run's first point. */
  readonly startLength: number;
  isClosed: boolean;
}

/** The view grown by a stroke's half-width: a segment wholly outside it paints nothing in view. */
function viewBox(paint: ShorePaint): MetreBox {
  const { view } = paint;
  return { minX: -view.halfWidthM, minY: -view.halfHeightM, maxX: view.halfWidthM, maxY: view.halfHeightM };
}

/** The runs being collected along one polyline: the open run, the first one, and the arc length so far. */
interface RunCollection {
  readonly runs: Run[];
  open: Run | null;
  first: Run | null;
  length: number;
}

/** Adds a near segment to the open run, opening one when there is none. */
function extendRun(
  collection: RunCollection,
  segment: {
    readonly index: number;
    readonly start: readonly [number, number];
    readonly end: readonly [number, number];
  },
): void {
  if (collection.open === null) {
    const run: Run = { points: [...segment.start], startLength: collection.length, isClosed: false };
    if (segment.index === 0) collection.first = run;
    collection.runs.push(run);
    collection.open = run;
  }
  collection.open.points.push(...segment.end);
}

/** The runs of one polyline whose segments lie near the view. */
function polylineRuns(
  paint: ShorePaint,
  polyline: Polyline,
  options: { readonly halfWidthM: number; readonly isClosed: boolean },
): Run[] {
  const count = pointCount(polyline);
  const segments = options.isClosed ? count : count - 1;
  const window = viewBox(paint);
  const collection: RunCollection = { runs: [], open: null, first: null, length: 0 };
  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % count;
    const start: [number, number] = [pointX(polyline, index), pointY(polyline, index)];
    const end: [number, number] = [pointX(polyline, next), pointY(polyline, next)];
    if (isOutside(segmentBox(start, end), window, options.halfWidthM)) collection.open = null;
    else extendRun(collection, { index, start, end });
    collection.length += Math.hypot(end[0] - start[0], end[1] - start[1]);
  }
  closeSeam(collection.runs, { run: collection.open, first: collection.first, isClosed: options.isClosed, segments });
  return collection.runs;
}

/** A closed ring kept whole stays closed; a run through the seam joins the run that starts at vertex 0. */
function closeSeam(
  runs: Run[],
  seam: { readonly run: Run | null; readonly first: Run | null; readonly isClosed: boolean; readonly segments: number },
): void {
  const { run, first } = seam;
  if (!seam.isClosed || run === null || first === null) return;
  if (run !== first) {
    run.points.push(...first.points.slice(POINT_STRIDE));
    runs.splice(runs.indexOf(first), 1);
  } else if (pointCount(run.points) === seam.segments + 1) {
    run.points.length -= POINT_STRIDE;
    run.isClosed = true;
  }
}

/** One run's path, keeping a vertex each time the arc length passes a multiple of `toleranceM`. */
function runPath(paint: ShorePaint, run: Run, toleranceM: number): void {
  const context = paint.context;
  const points = run.points;
  const count = pointCount(points);
  let length = run.startLength;
  let cell = Math.floor(length / toleranceM);
  context.moveTo(pointX(points, 0), pointY(points, 0));
  for (let index = 1; index < count; index += 1) {
    length += Math.hypot(
      pointX(points, index) - pointX(points, index - 1),
      pointY(points, index) - pointY(points, index - 1),
    );
    const reached = Math.floor(length / toleranceM);
    if (reached === cell && index !== count - 1) continue;
    cell = reached;
    context.lineTo(pointX(points, index), pointY(points, index));
  }
  if (run.isClosed) context.closePath();
}

/** One path of the runs, thinned to `toleranceM` of arc length (`runsPath`). */
function runsPath(paint: ShorePaint, runs: readonly Run[], toleranceM: number): void {
  paint.context.beginPath();
  for (const run of runs) runPath(paint, run, toleranceM);
}

/**
 * The path for a solid stroke of half-width `halfWidthM` along the polylines, near the view only, thinned to a small
 * share of the narrowest width that will be stroked on it, `thinnestHalfWidthM` (`strokeNearPath`).
 */
export function strokeNearPath(
  paint: ShorePaint,
  polylines: readonly Polyline[],
  stroke: { readonly halfWidthM: number; readonly isClosed?: boolean; readonly thinnestHalfWidthM?: number },
): void {
  const isClosed = stroke.isClosed ?? true;
  const runs = polylines.flatMap((polyline) =>
    pointCount(polyline) >= MIN_POLYLINE_POINTS
      ? polylineRuns(paint, polyline, { halfWidthM: stroke.halfWidthM, isClosed })
      : [],
  );
  const thinnest = stroke.thinnestHalfWidthM ?? stroke.halfWidthM;
  runsPath(
    paint,
    runs,
    Math.max(thinnest * SHORE_NEAR_STROKE.toleranceShare, pxToMetres(paint.view, SHORE_NEAR_STROKE.toleranceMinPx)),
  );
}

/** Strokes the near path of a half-width with a colour, `2 × halfWidthM` wide. */
export function strokeAlongCoast(
  paint: ShorePaint,
  polylines: readonly Polyline[],
  stroke: { readonly halfWidthM: number; readonly colour: string; readonly widthM?: number },
): void {
  strokeNearPath(paint, polylines, { halfWidthM: stroke.halfWidthM });
  paint.context.lineWidth = stroke.widthM ?? DIAMETER_PER_RADIUS * stroke.halfWidthM;
  paint.context.strokeStyle = stroke.colour;
  paint.context.stroke();
}

/** How far to offset at a point: a number of metres, or a function of the point (negative goes inland). */
export type OffsetDistance = number | ((x: number, y: number) => number);

/** A copy of every coast ring offset toward the sea by `distance`, normals smoothed over `window` samples (`offsetRings`). */
export function offsetRings(paint: ShorePaint, distance: OffsetDistance, window: number): Float64Array[] {
  return paint.coast.rings.map((ring) => {
    const points = ring.points;
    const count = pointCount(points);
    const out = new Float64Array(points.length);
    for (let index = 0; index < count; index += 1) {
      const before = (index - window + count) % count;
      const after = (index + window) % count;
      let tangentX = pointX(points, after) - pointX(points, before);
      let tangentY = pointY(points, after) - pointY(points, before);
      const length = Math.hypot(tangentX, tangentY) || 1;
      tangentX /= length;
      tangentY /= length;
      const x = pointX(points, index);
      const y = pointY(points, index);
      // land lies where (t × (q − p)) · sign > 0, so the sea normal is −sign · (−ty, tx)
      const metres = typeof distance === 'number' ? distance : distance(x, y);
      out[index * POINT_STRIDE] = x + ring.landSign * tangentY * metres;
      out[index * POINT_STRIDE + 1] = y - ring.landSign * tangentX * metres;
    }
    return out;
  });
}
