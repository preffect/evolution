// How far from the medallion's centre a glyph's layer reaches (docs/visual-style/ui-type.md §7.2), for the specs that
// hold a glyph inside its frame. The list LOD draws the glyph 1.2× larger inside the same frame, so a drawing has to
// fit with room to spare.
//
// **The measurement must never under-report**, or it passes drawings the frame then cuts — which is exactly the bug
// this file shipped with: it read a circle through its path data, whose two arcs run between the *horizontal*
// extremes, so the top and bottom of every disc went unmeasured and seven drawings slipped past. So: a circle or an
// ellipse is measured from its own geometry and never through a path; an arc is measured by walking the arc itself,
// not by its endpoints; and a Bézier is measured through its control points, which its curve is guaranteed to stay
// inside. Over-reporting a curve by a fraction of a unit is safe. Under-reporting anything is not, and
// `glyph-bounds.spec.ts` pins each way it could go blind again.

import { GLYPH_CENTRE } from '../app/game/render/constants/trait-glyph-layers';
import type { GlyphLayer, GlyphShape } from '../app/game/render/svg-glyph';

export type BoundsPoint = readonly [number, number];

/** How finely a curved run is sampled: at the medallion's radius this resolves to well under a hundredth of a unit. */
const ARC_SAMPLES = 128;
const FULL_TURN_RADIANS = Math.PI * 2;
const HALF = 0.5;
const DEGREES_TO_RADIANS = Math.PI / 180;

/** Every SVG path command letter, and how many numbers one of its argument sets takes. */
const ARGUMENT_COUNT: Readonly<Record<string, number>> = {
  m: 2,
  l: 2,
  h: 1,
  v: 1,
  c: 6,
  s: 4,
  q: 4,
  t: 2,
  a: 7,
  z: 0,
};
/**
 * Which numbers of one argument set are a point on the page, as the index of each (x, y) pair. A curve's control
 * points are included deliberately: the curve stays inside their hull, so counting them can only over-report. An
 * arc's seven end in its endpoint, but the arc's own sweep is measured separately — see `arcPoints`.
 */
const POINT_INDICES: Readonly<Record<string, readonly number[]>> = {
  m: [0],
  l: [0],
  c: [0, 2, 4],
  s: [0, 2],
  q: [0, 2],
  t: [0],
  a: [5],
};
const NUMBER_TOKEN = /^-?\d*\.?\d+(?:e[-+]?\d+)?$/i;
const PATH_TOKEN = /[astvzqmhlc]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

/** An ellipse in the page's own frame: what both a circle shape and an arc's underlying curve reduce to. */
interface BoundsEllipse {
  readonly centre: BoundsPoint;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly rotationRadians: number;
}

/** The point on an ellipse at a parameter angle. */
function ellipsePoint(ellipse: BoundsEllipse, angle: number): BoundsPoint {
  const cosRotation = Math.cos(ellipse.rotationRadians);
  const sinRotation = Math.sin(ellipse.rotationRadians);
  const alongX = ellipse.radiusX * Math.cos(angle);
  const alongY = ellipse.radiusY * Math.sin(angle);
  return [
    ellipse.centre[0] + alongX * cosRotation - alongY * sinRotation,
    ellipse.centre[1] + alongX * sinRotation + alongY * cosRotation,
  ];
}

/** `count` points spread evenly along a run of an ellipse, from `startAngle` through `sweepAngle`. */
function ellipseRun(ellipse: BoundsEllipse, startAngle: number, sweepAngle: number): readonly BoundsPoint[] {
  return Array.from({ length: ARC_SAMPLES + 1 }, (_unused, index) =>
    ellipsePoint(ellipse, startAngle + (sweepAngle * index) / ARC_SAMPLES),
  );
}

/** An `A`/`a` command's seven numbers, named. */
interface ArcArguments {
  readonly radiusX: number;
  readonly radiusY: number;
  readonly rotationRadians: number;
  readonly isLargeArc: boolean;
  readonly isPositiveSweep: boolean;
}

function arcArguments(args: readonly number[]): ArcArguments | null {
  const [radiusX = 0, radiusY = 0, rotationDegrees = 0, largeArcFlag = 0, sweepFlag = 0] = args;
  if (radiusX === 0 || radiusY === 0) return null;
  return {
    radiusX: Math.abs(radiusX),
    radiusY: Math.abs(radiusY),
    rotationRadians: rotationDegrees * DEGREES_TO_RADIANS,
    isLargeArc: largeArcFlag !== 0,
    isPositiveSweep: sweepFlag !== 0,
  };
}

/** The angle from one vector to another, signed: the ellipse is walked in the direction the sweep flag asks for. */
function signedAngleBetween(from: BoundsPoint, until: BoundsPoint): number {
  const dot = from[0] * until[0] + from[1] * until[1];
  const magnitude = Math.hypot(from[0], from[1]) * Math.hypot(until[0], until[1]);
  const sign = from[0] * until[1] - from[1] * until[0] < 0 ? -1 : 1;
  return sign * Math.acos(Math.min(1, Math.max(-1, dot / magnitude)));
}

/** The centre offset in the ellipse's own frame, and the radii grown to reach the endpoints (SVG 1.1 F.6.5–F.6.6). */
function arcCentreLocal(arc: ArcArguments, halfChord: BoundsPoint): { ellipse: ArcArguments; offset: BoundsPoint } {
  const oversize =
    (halfChord[0] * halfChord[0]) / (arc.radiusX * arc.radiusX) +
    (halfChord[1] * halfChord[1]) / (arc.radiusY * arc.radiusY);
  const growth = oversize > 1 ? Math.sqrt(oversize) : 1;
  const ellipse: ArcArguments = { ...arc, radiusX: arc.radiusX * growth, radiusY: arc.radiusY * growth };
  const squaredX = ellipse.radiusX * ellipse.radiusX;
  const squaredY = ellipse.radiusY * ellipse.radiusY;
  const numerator =
    squaredX * squaredY - squaredX * halfChord[1] * halfChord[1] - squaredY * halfChord[0] * halfChord[0];
  const denominator = squaredX * halfChord[1] * halfChord[1] + squaredY * halfChord[0] * halfChord[0];
  const reach = Math.sqrt(Math.max(0, numerator / denominator)) * (arc.isLargeArc === arc.isPositiveSweep ? -1 : 1);
  return {
    ellipse,
    offset: [
      (reach * ellipse.radiusX * halfChord[1]) / ellipse.radiusY,
      (-reach * ellipse.radiusY * halfChord[0]) / ellipse.radiusX,
    ],
  };
}

/**
 * The arc itself, sampled: where a path's `A` or `a` command really goes between its two endpoints. An arc's
 * endpoints say nothing about the extremes between them, which is why reading them alone is not a measurement.
 */
function arcPoints(from: BoundsPoint, args: readonly number[], until: BoundsPoint): readonly BoundsPoint[] {
  const arc = arcArguments(args);
  if (arc === null) return [until];
  const cosRotation = Math.cos(arc.rotationRadians);
  const sinRotation = Math.sin(arc.rotationRadians);
  const midX = (from[0] - until[0]) * HALF;
  const midY = (from[1] - until[1]) * HALF;
  const halfChord: BoundsPoint = [cosRotation * midX + sinRotation * midY, -sinRotation * midX + cosRotation * midY];
  const { ellipse, offset } = arcCentreLocal(arc, halfChord);
  const centre: BoundsPoint = [
    cosRotation * offset[0] - sinRotation * offset[1] + (from[0] + until[0]) * HALF,
    sinRotation * offset[0] + cosRotation * offset[1] + (from[1] + until[1]) * HALF,
  ];
  const startVector: BoundsPoint = [
    (halfChord[0] - offset[0]) / ellipse.radiusX,
    (halfChord[1] - offset[1]) / ellipse.radiusY,
  ];
  const endVector: BoundsPoint = [
    (-halfChord[0] - offset[0]) / ellipse.radiusX,
    (-halfChord[1] - offset[1]) / ellipse.radiusY,
  ];
  const startAngle = signedAngleBetween([1, 0], startVector);
  const rawSweep = signedAngleBetween(startVector, endVector) % FULL_TURN_RADIANS;
  const sweepAngle = arc.isPositiveSweep
    ? rawSweep + (rawSweep < 0 ? FULL_TURN_RADIANS : 0)
    : rawSweep - (rawSweep > 0 ? FULL_TURN_RADIANS : 0);
  const curve: BoundsEllipse = {
    centre,
    radiusX: ellipse.radiusX,
    radiusY: ellipse.radiusY,
    rotationRadians: arc.rotationRadians,
  };
  return ellipseRun(curve, startAngle, sweepAngle);
}

interface Cursor {
  x: number;
  y: number;
  /** Where the current subpath began: `Z` closes back to it, and the next relative command starts from there. */
  subpathX: number;
  subpathY: number;
}

/** `Z`, `H` and `V` move the cursor without naming a full point; this is where it ends up. */
function cursorAfterShorthand(letter: string, args: readonly number[], cursor: Cursor, origin: BoundsPoint): void {
  if (letter === 'z') {
    cursor.x = cursor.subpathX;
    cursor.y = cursor.subpathY;
    return;
  }
  if (letter === 'h') cursor.x = origin[0] + args[0]!;
  else cursor.y = origin[1] + args[0]!;
}

/** One argument set of a command, applied to the cursor; returns the points it puts on the page. */
function pointsOfArguments(command: string, args: readonly number[], cursor: Cursor): readonly BoundsPoint[] {
  const letter = command.toLowerCase();
  const origin: BoundsPoint = command === letter ? [cursor.x, cursor.y] : [0, 0];
  if (letter === 'z' || letter === 'h' || letter === 'v') {
    cursorAfterShorthand(letter, args, cursor, origin);
    return [[cursor.x, cursor.y]];
  }
  const points = (POINT_INDICES[letter] ?? []).map((index): BoundsPoint => [
    origin[0] + args[index]!,
    origin[1] + args[index + 1]!,
  ]);
  const from: BoundsPoint = [cursor.x, cursor.y];
  const last = points[points.length - 1];
  if (last === undefined) return points;
  cursor.x = last[0];
  cursor.y = last[1];
  if (letter === 'm') {
    cursor.subpathX = cursor.x;
    cursor.subpathY = cursor.y;
  }
  return letter === 'a' ? arcPoints(from, args, last) : points;
}

/**
 * Every point an SVG path puts on the page: curve control points included (the curve stays inside them) and arcs
 * walked rather than jumped, so no extreme between two endpoints is missed.
 */
export function pathPoints(pathData: string): readonly BoundsPoint[] {
  const tokens = pathData.match(PATH_TOKEN) ?? [];
  const cursor: Cursor = { x: 0, y: 0, subpathX: 0, subpathY: 0 };
  const points: BoundsPoint[] = [];
  let command = 'M';
  let pending: number[] = [];
  const flush = (): void => {
    const size = ARGUMENT_COUNT[command.toLowerCase()] ?? 0;
    if (size === 0) {
      if (command.toLowerCase() === 'z') points.push(...pointsOfArguments(command, [], cursor));
      return;
    }
    while (pending.length >= size) {
      points.push(...pointsOfArguments(command, pending.slice(0, size), cursor));
      pending = pending.slice(size);
    }
  };
  for (const token of tokens) {
    if (NUMBER_TOKEN.test(token)) {
      pending.push(Number(token));
      continue;
    }
    flush();
    command = token;
    pending = [];
  }
  flush();
  return points;
}

/** The medallion's centre, which every reach is measured from. */
const MEDALLION_CENTRE: BoundsPoint = [GLYPH_CENTRE, GLYPH_CENTRE];

function distanceFromCentre(point: BoundsPoint, offsetX: number, offsetY: number): number {
  return Math.hypot(point[0] + offsetX - MEDALLION_CENTRE[0], point[1] + offsetY - MEDALLION_CENTRE[1]);
}

/**
 * How far a shape's outline reaches from the medallion's centre. A circle or an ellipse is walked round its own
 * boundary — never through path data, whose arcs run between the horizontal extremes and would hide the top and
 * bottom — and anything else through its path.
 */
export function shapeReach(shape: GlyphShape, offsetX = 0, offsetY = 0): number {
  const points =
    shape.kind === 'path'
      ? pathPoints(shape.d)
      : ellipseRun(
          {
            centre: [shape.cx, shape.cy],
            radiusX: shape.kind === 'circle' ? shape.r : shape.rx,
            radiusY: shape.kind === 'circle' ? shape.r : shape.ry,
            rotationRadians: 0,
          },
          0,
          FULL_TURN_RADIANS,
        );
  return Math.max(0, ...points.map((point) => distanceFromCentre(point, offsetX, offsetY)));
}

/** How far the layer's drawing reaches from the medallion's centre, its offset and its stroke's half width included. */
export function layerReach(layer: GlyphLayer): number {
  return shapeReach(layer.shape, layer.offset?.x ?? 0, layer.offset?.y ?? 0) + (layer.stroke?.width ?? 0) * HALF;
}
