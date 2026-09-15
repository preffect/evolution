// The trait glyph's drawing model (docs/visual-style/ui-type.md §7.1): a glyph is an ordered stack of SVG primitives
// in a 100 × 100 user-unit box, each painted with a palette colour, a lit ramp or a glow halo, so the HUD draws it
// as inline SVG with no bitmap. This file is the vocabulary and the pure builders the glyph tables in
// `render/constants/trait-glyphs-*.ts` are written in; `game/glyphs/trait-glyph.component.ts` is the one renderer.

import { RADIANS_PER_FULL_TURN, type TraitId } from '@evolution/shared';

/** Path coordinates keep two decimals: a hundredth of a unit is below a pixel at every glyph size. */
const PATH_DECIMALS = 2;

/** A circle, an ellipse or a path, in glyph user units (the SVG attribute names). */
export type GlyphShape =
  | { readonly kind: 'circle'; readonly cx: number; readonly cy: number; readonly r: number }
  | { readonly kind: 'ellipse'; readonly cx: number; readonly cy: number; readonly rx: number; readonly ry: number }
  | { readonly kind: 'path'; readonly d: string };

/** A body ramp lit from the top-left: light at the glint, base across the body, dark in the bottom-right pool. */
export interface GlyphRamp {
  readonly light: string;
  readonly base: string;
  readonly dark: string;
}

/** Solid colour, a lit ramp, or a glow halo (core, soft halo and wide halo in one radial falloff). */
export type GlyphFill =
  | { readonly kind: 'solid'; readonly colour: string; readonly opacity: number }
  | { readonly kind: 'ramp'; readonly ramp: GlyphRamp; readonly opacity: number }
  | { readonly kind: 'halo'; readonly colour: string; readonly opacity: number };

export interface GlyphStroke {
  readonly colour: string;
  readonly width: number;
  readonly opacity: number;
  /** An SVG dash array: pores in an envelope, hairs on a fringe. */
  readonly dash?: string;
}

/** The idle motions the glyph stylesheet defines; every one is a loop of `periodMs` and stops under reduced motion. */
export const GLYPH_MOTION = {
  /** Scale up to a few percent and back: a membrane breathing. */
  breathe: 'breathe',
  /** A quick swell and a slow settle: a heartbeat, the mitochondrion's sprint pulse, the toxin bladder. */
  beat: 'beat',
  /** Rotate a few degrees either way about the origin: a tail, a fringe, a stalk. */
  sway: 'sway',
  /** A full slow turn about the origin: a shell, an envelope. */
  spin: 'spin',
  /** Rise a little and fall back: vacuole bubbles. */
  rise: 'rise',
} as const;
export type GlyphMotionKind = (typeof GLYPH_MOTION)[keyof typeof GLYPH_MOTION];

export interface GlyphMotion {
  readonly kind: GlyphMotionKind;
  readonly periodMs: number;
  /** The pivot, in glyph user units. */
  readonly originX: number;
  readonly originY: number;
}

/** What a layer is, so a test can pin the ASSET-GENERATION §6 stack (halo, pool, body, detail, signature, outline, glint). */
export const GLYPH_ROLE = {
  halo: 'halo',
  pool: 'pool',
  outline: 'outline',
  body: 'body',
  detail: 'detail',
  signature: 'signature',
  glint: 'glint',
} as const;
export type GlyphRole = (typeof GLYPH_ROLE)[keyof typeof GLYPH_ROLE];

export interface GlyphLayer {
  readonly role: GlyphRole;
  readonly shape: GlyphShape;
  readonly fill?: GlyphFill;
  readonly stroke?: GlyphStroke;
  readonly motion?: GlyphMotion;
  /** A translation in user units, drawn as a wrapping group so an idle motion's CSS transform never replaces it. */
  readonly offset?: { readonly x: number; readonly y: number };
}

export interface TraitGlyph {
  /** The trait this glyph names: the tables are lists, since trait ids are snake_case and never object keys. */
  readonly traitId: TraitId;
  /** The whole drawing turns this far about the centre: a bean or a slipper lies at an angle, not flat. */
  readonly tiltDeg: number;
  readonly layers: readonly GlyphLayer[];
}

export function circle(centreX: number, centreY: number, radius: number): GlyphShape {
  return { kind: 'circle', cx: centreX, cy: centreY, r: radius };
}

export function ellipse(centreX: number, centreY: number, radiusX: number, radiusY: number): GlyphShape {
  return { kind: 'ellipse', cx: centreX, cy: centreY, rx: radiusX, ry: radiusY };
}

export function path(pathData: string): GlyphShape {
  return { kind: 'path', d: pathData };
}

type Point = readonly [number, number];

/** A point `radius` from `centre` at `turns` of a full turn clockwise from 3 o'clock. */
function polar(centre: Point, radius: number, turns: number): Point {
  const angle = turns * RADIANS_PER_FULL_TURN;
  return [centre[0] + radius * Math.cos(angle), centre[1] + radius * Math.sin(angle)];
}

function formatPoint([x, y]: Point): string {
  return `${x.toFixed(PATH_DECIMALS)} ${y.toFixed(PATH_DECIMALS)}`;
}

/** One dot as a closed pair of arcs, starting at its left edge. */
function dotPath([x, y]: Point, dotRadius: number): string {
  const diameter = dotRadius + dotRadius;
  const arc = `a${dotRadius} ${dotRadius} 0 1 0`;
  return `M${formatPoint([x - dotRadius, y])} ${arc} ${diameter} 0 ${arc} ${-diameter} 0`;
}

export interface RadialStrokesSpec {
  readonly cx: number;
  readonly cy: number;
  readonly count: number;
  readonly innerRadius: number;
  readonly outerRadius: number;
  /** How far the outer end trails the inner one, in turns: 0 for spokes, a lean for hairs. */
  readonly leanTurns: number;
  /** Where the first stroke starts, in turns. */
  readonly phaseTurns: number;
}

/** `count` straight strokes around a centre in one path: spokes, striae, spines, leaning cilia. */
export function radialStrokesPath(spec: RadialStrokesSpec): string {
  const centre: Point = [spec.cx, spec.cy];
  return Array.from({ length: spec.count }, (_unused, index) => {
    const turns = spec.phaseTurns + index / spec.count;
    const start = polar(centre, spec.innerRadius, turns);
    const end = polar(centre, spec.outerRadius, turns + spec.leanTurns);
    return `M${formatPoint(start)} L${formatPoint(end)}`;
  }).join(' ');
}

export interface PolygonSpec {
  readonly cx: number;
  readonly cy: number;
  readonly sides: number;
  /** The corners' distance from the centre. */
  readonly radius: number;
  /** Where the first corner sits, in turns. */
  readonly phaseTurns: number;
}

/** A closed regular polygon in one path: a plated wall. */
export function polygonPath(spec: PolygonSpec): string {
  const centre: Point = [spec.cx, spec.cy];
  const corners = Array.from({ length: spec.sides }, (_unused, index) =>
    formatPoint(polar(centre, spec.radius, spec.phaseTurns + index / spec.sides)),
  );
  return `M${corners.join(' L')} Z`;
}

export interface DotRingSpec {
  readonly cx: number;
  readonly cy: number;
  readonly count: number;
  readonly ringRadius: number;
  readonly dotRadius: number;
  readonly phaseTurns: number;
}

/** `count` dots evenly around a ring in one path: pores, ribosomes, spine tips. */
export function dotRingPath(spec: DotRingSpec): string {
  const centre: Point = [spec.cx, spec.cy];
  return Array.from({ length: spec.count }, (_unused, index) =>
    dotPath(polar(centre, spec.ringRadius, spec.phaseTurns + index / spec.count), spec.dotRadius),
  ).join(' ');
}

/** Dots at listed centres in one path: a beaded macronucleus, chromatin speckle. */
export function dotsPath(centres: readonly Point[], dotRadius: number): string {
  return centres.map((centre) => dotPath(centre, dotRadius)).join(' ');
}
