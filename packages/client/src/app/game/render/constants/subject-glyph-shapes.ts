// The shapes the subject glyphs are drawn from (docs/visual-style/ui-type.md §7.2), in glyph user units of the
// 100 × 100 box. `svg-glyph.ts` holds the vocabulary every glyph shares (circles, dot rings, radial strokes); these
// are the forms only the subjects need — the rod a bacterium is, the arrow every action gesture ends in, the lobed
// outline of a free-swimming cell, the helix strand of a DNA fragment, the arc and crescent a zone or a mouth is cut
// from. Pure string builders: no colour, no layer, no motion.

import { formatPoint, polar, type Point } from '../svg-glyph';

/** A quarter turn: the perpendicular of an axis, clockwise on screen (y grows downward). */
const QUARTER_TURN = 0.25;
const HALF_TURN = 0.5;
/** How far a smooth curve's control point sits from the sample it bends around: the midpoint construction. */
const MIDPOINT_SHARE = 0.5;

function midpoint(from: Point, until: Point): Point {
  return [from[0] + (until[0] - from[0]) * MIDPOINT_SHARE, from[1] + (until[1] - from[1]) * MIDPOINT_SHARE];
}

/**
 * A smooth curve through `points`: each sample becomes a quadratic control point and the midpoints between them the
 * on-curve points, so the curve never kinks. `closed` wraps it, which is how a lobed cell outline is drawn.
 */
export function smoothPath(points: readonly Point[], isClosed: boolean): string {
  const last = points[points.length - 1]!;
  const start = isClosed ? midpoint(last, points[0]!) : points[0]!;
  const steps = points.map((point, index) => {
    const next = points[index + 1];
    const end = next === undefined ? (isClosed ? midpoint(point, points[0]!) : point) : midpoint(point, next);
    return `Q${formatPoint(point)} ${formatPoint(end)}`;
  });
  return `M${formatPoint(start)} ${steps.join(' ')}${isClosed ? ' Z' : ''}`;
}

export interface LobedSpec {
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  /** How many shallow lobes ride the outline: a free-swimming cell rests at 5 to 7. */
  readonly lobes: number;
  /** How far a lobe stands proud of the radius. */
  readonly lobeDepth: number;
  readonly phaseTurns: number;
}

/** A closed cell outline with shallow rest lobes: the wobble a swimming cell holds, frozen. */
export function lobedPath(spec: LobedSpec): string {
  const samplesPerLobe = 6;
  const count = spec.lobes * samplesPerLobe;
  const centre: Point = [spec.cx, spec.cy];
  const points = Array.from({ length: count }, (_unused, index) => {
    const turns = index / count;
    const wobble = Math.cos((turns - spec.phaseTurns) * spec.lobes * Math.PI * 2);
    return polar(centre, spec.radius + spec.lobeDepth * wobble, turns);
  });
  return smoothPath(points, true);
}

/** A closed circle as path data, so a mark made of a ring and its ticks is one path and takes one paint. */
export function circlePath(centreX: number, centreY: number, radius: number): string {
  const arc = `a${radius} ${radius} 0 1 0`;
  const diameter = radius + radius;
  return `M${formatPoint([centreX - radius, centreY])} ${arc} ${diameter} 0 ${arc} ${-diameter} 0 Z`;
}

export interface ArcSpec {
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  readonly fromTurns: number;
  readonly toTurns: number;
}

/** An open arc of a circle, clockwise from `fromTurns` to `toTurns`: a zone band, a ring gauge, a sweep. */
export function arcPath(spec: ArcSpec): string {
  const centre: Point = [spec.cx, spec.cy];
  const start = polar(centre, spec.radius, spec.fromTurns);
  const end = polar(centre, spec.radius, spec.toTurns);
  const largeArc = spec.toTurns - spec.fromTurns > HALF_TURN ? 1 : 0;
  return `M${formatPoint(start)} A${spec.radius} ${spec.radius} 0 ${largeArc} 1 ${formatPoint(end)}`;
}

export interface CrescentSpec extends ArcSpec {
  /** The band's thickness, inward from `radius`. */
  readonly thickness: number;
}

/** A closed ring segment: the open mouth of an engulfing cell, a thick gauge arc, a wrapping shell. */
export function crescentPath(spec: CrescentSpec): string {
  const centre: Point = [spec.cx, spec.cy];
  const inner = spec.radius - spec.thickness;
  const largeArc = spec.toTurns - spec.fromTurns > HALF_TURN ? 1 : 0;
  return [
    arcPath(spec),
    `L${formatPoint(polar(centre, inner, spec.toTurns))}`,
    `A${inner} ${inner} 0 ${largeArc} 0 ${formatPoint(polar(centre, inner, spec.fromTurns))}`,
    'Z',
  ].join(' ');
}

export interface RodSpec {
  readonly cx: number;
  readonly cy: number;
  /** Half the straight run between the two end caps. */
  readonly halfLength: number;
  readonly radius: number;
  /** Where the rod's long axis points, in turns. */
  readonly turns: number;
}

/** A stadium: two half-disc caps joined by straight sides, which is the rod a bacterium is drawn as in the dish. */
export function rodPath(spec: RodSpec): string {
  const centre: Point = [spec.cx, spec.cy];
  const along = (distance: number, sideways: number): Point => {
    const onAxis = polar(centre, distance, spec.turns);
    const offset = polar([0, 0], sideways, spec.turns + QUARTER_TURN);
    return [onAxis[0] + offset[0], onAxis[1] + offset[1]];
  };
  const cap = `A${spec.radius} ${spec.radius} 0 0 0`;
  return [
    `M${formatPoint(along(-spec.halfLength, spec.radius))}`,
    `L${formatPoint(along(spec.halfLength, spec.radius))}`,
    `${cap} ${formatPoint(along(spec.halfLength, -spec.radius))}`,
    `L${formatPoint(along(-spec.halfLength, -spec.radius))}`,
    `${cap} ${formatPoint(along(-spec.halfLength, spec.radius))}`,
    'Z',
  ].join(' ');
}

export interface StrandSpec {
  readonly fromX: number;
  readonly toX: number;
  readonly y: number;
  readonly amplitude: number;
  /** How many full waves fit between the ends: a fragment's two strands run one wave. */
  readonly waves: number;
  /** Half a turn apart is the second strand of a helix. */
  readonly phaseTurns: number;
}

const STRAND_SAMPLES_PER_WAVE = 8;

/** One sine strand: a flagellum's tail, a helix's backbone, a shimmer line. */
export function strandPath(spec: StrandSpec): string {
  const count = spec.waves * STRAND_SAMPLES_PER_WAVE;
  const points = Array.from({ length: count + 1 }, (_unused, index): Point => {
    const share = index / count;
    const angle = (share * spec.waves + spec.phaseTurns) * Math.PI * 2;
    return [spec.fromX + (spec.toX - spec.fromX) * share, spec.y + Math.sin(angle) * spec.amplitude];
  });
  return smoothPath(points, false);
}

/** The rungs between a helix's two strands, in one path: the ladder that carries a fragment's tag colour. */
export function rungsPath(spec: StrandSpec & { readonly count: number }): string {
  return Array.from({ length: spec.count }, (_unused, index) => {
    const share = (index + MIDPOINT_SHARE) / spec.count;
    const x = spec.fromX + (spec.toX - spec.fromX) * share;
    const reach = Math.sin(share * spec.waves * Math.PI * 2) * spec.amplitude;
    return `M${formatPoint([x, spec.y - reach])} L${formatPoint([x, spec.y + reach])}`;
  }).join(' ');
}

export interface ArrowSpec {
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  /** How far the shaft bows to the left of its run: 0 draws it straight. */
  readonly bow: number;
  readonly headLength: number;
}

/** Where an arrow's head meets its shaft, and the direction it points, in turns. */
function arrowTip(spec: ArrowSpec): { readonly turns: number; readonly base: Point } {
  const runX = spec.toX - spec.fromX;
  const runY = spec.toY - spec.fromY;
  const turns = Math.atan2(runY, runX) / (Math.PI * 2);
  const base = polar([spec.toX, spec.toY], -spec.headLength, turns);
  return { turns, base };
}

/** An arrow's shaft: a bowed line stopping where its head begins, so the head's point is the arrow's point. */
export function arrowShaftPath(spec: ArrowSpec): string {
  const { base } = arrowTip(spec);
  const straight: Point = [(spec.fromX + base[0]) * MIDPOINT_SHARE, (spec.fromY + base[1]) * MIDPOINT_SHARE];
  const runTurns = Math.atan2(base[1] - spec.fromY, base[0] - spec.fromX) / (Math.PI * 2);
  const control = polar(straight, spec.bow, runTurns - QUARTER_TURN);
  return `M${formatPoint([spec.fromX, spec.fromY])} Q${formatPoint(control)} ${formatPoint(base)}`;
}

/** An arrow's head as a closed triangle on its point: the mark that says a subject is an action, never an ability. */
export function arrowHeadPath(spec: ArrowSpec): string {
  const { turns, base } = arrowTip(spec);
  const halfWidth = spec.headLength * MIDPOINT_SHARE;
  const corners = [
    [spec.toX, spec.toY] as Point,
    polar(base, halfWidth, turns + QUARTER_TURN),
    polar(base, halfWidth, turns - QUARTER_TURN),
  ];
  return `M${corners.map(formatPoint).join(' L')} Z`;
}
