// The trait glyph's shared layer stack (docs/visual-style/ui-type.md §7.1): the medallion frame every glyph sits in,
// the lit ramps, and the builders for the halo, dark pool, outline, body and glint layers the glyph tables repeat.
// Numbers are glyph user units in the 100 × 100 box; opacities are 0..1; periods are ms.

import {
  ellipse,
  circle,
  GLYPH_MOTION,
  GLYPH_ROLE,
  type GlyphFill,
  type GlyphLayer,
  type GlyphMotion,
  type GlyphMotionKind,
  type GlyphRamp,
  type GlyphRole,
  type GlyphShape,
  type GlyphStroke,
} from '../svg-glyph';
import {
  BLACK,
  CHLORO_BASE,
  CHLORO_DARK,
  CHLORO_LIGHT,
  DNA_DEEP,
  ENVELOPE,
  MITO_BASE,
  MITO_DARK,
  MITO_LIGHT,
  NUCLEOID_GLOW,
  OUTLINE,
  PROTO_FILM,
  PROTO_FILM_LIGHT,
  SILICA_BASE,
  SILICA_DARK,
  SILICA_LIGHT,
  TOXIN_BASE,
  TOXIN_RIM,
  VAC_BASE,
  VAC_RIM,
  WHITE,
} from './colours';

/** The glyph's user-unit box: 100 wide and tall, centred on (50, 50). */
export const GLYPH_BOX = 100;
export const GLYPH_CENTRE = 50;
/** The box centre as a `cx` / `cy` pair, spread into the radial path specs. */
export const GLYPH_CENTRE_POINT = { cx: GLYPH_CENTRE, cy: GLYPH_CENTRE } as const;
/** A glyph that lies flat: no tilt about the centre. */
export const GLYPH_NO_TILT = 0;

/** The medallion disc: the dark-field stage the glyph sits on, its condenser pool and its rim. */
export const GLYPH_FRAME = {
  radius: 47,
  rimWidth: 1.5,
  /** The rim's top-left scatter, brightest where the light comes from (visual-style/principles-and-palette.md §1). */
  rimLightOpacity: 0.6,
  /** The rim from 190° to 260°: the top-left arc of the disc. */
  rimLightPath: 'M3.71 41.84 A47 47 0 0 1 41.84 3.71',
  poolCx: 34,
  poolCy: 30,
  poolRadius: 30,
  poolOpacity: 0.16,
} as const;

/** Where a lit ramp's light sits in its body's box (top-left) and how far the falloff reaches. */
export const GLYPH_RAMP_LIGHT = { fx: 0.34, fy: 0.3, reach: 0.78, baseStop: 0.5 } as const;
/** A halo's core, soft halo and wide halo as stops of one falloff: the soft stop and its share of the core. */
export const GLYPH_HALO_FALLOFF = { softStop: 0.45, softShare: 0.4 } as const;

/** The dark pool sits down and right of the body it shades: light comes from the top-left. */
export const GLYPH_POOL = { offsetX: 3, offsetY: 4, opacity: 0.45 } as const;
export const GLYPH_OUTLINE = { extraWidth: 2.5, opacity: 0.9 } as const;
export const GLYPH_GLINT_OPACITY = 0.85;
/**
 * At the list LOD (20 px, a fifth of a unit per pixel) a glyph's strokes are thickened by this much, so hairs, spokes,
 * rings and tails stay at least a pixel wide. The frame keeps its own rim.
 */
export const GLYPH_LIST_STROKE_BOOST = 1.8;
/** At the list LOD the glyph (never its frame) is drawn this much larger about the centre, filling the medallion. */
export const GLYPH_LIST_ZOOM = 1.2;
export const GLYPH_HALO_OPACITY = 0.5;

/**
 * The idle motions' amplitudes (visual-style/ui-type.md §7.1), published to the keyframes as CSS custom properties by
 * `glyphs/glyph-motion-variables.ts`: a breathe and a beat swell to these scales, a sway turns this far either way, a
 * rise lifts this many user units. Both pulses stay under `GLYPH_PULSE_CEILING`.
 */
export const GLYPH_MOTION_AMPLITUDE = { breatheScale: 1.04, beatScale: 1.08, swayDeg: 4, riseUnits: 3 } as const;
/** The largest scale any pulse may reach (visual-style/motion-and-legibility.md §5: pulses ≤ 1.14×). */
export const GLYPH_PULSE_CEILING = 1.14;

/**
 * Idle periods, slow enough that three cards side by side never read as busy (visual-style/motion-and-legibility.md §5):
 * even the beat, the quickest, stays near the 0.5 Hz rest rate so one card never pulls the eye.
 */
export const GLYPH_PERIOD_MS = {
  breathe: 4200,
  beat: 2400,
  sway: 2600,
  spin: 40000,
  rise: 2000,
} as const;

/** The ramps the glyphs are lit with: every one a §2 organelle family, so no glyph wears a player's palette. */
export const GLYPH_RAMP = {
  protocell: { light: PROTO_FILM_LIGHT, base: PROTO_FILM, dark: SILICA_DARK },
  vacuole: { light: VAC_RIM, base: VAC_BASE, dark: SILICA_DARK },
  mitochondrion: { light: MITO_LIGHT, base: MITO_BASE, dark: MITO_DARK },
  chloroplast: { light: CHLORO_LIGHT, base: CHLORO_BASE, dark: CHLORO_DARK },
  nucleus: { light: ENVELOPE, base: NUCLEOID_GLOW, dark: SILICA_DARK },
  toxin: { light: TOXIN_RIM, base: TOXIN_BASE, dark: DNA_DEEP },
  silica: { light: SILICA_LIGHT, base: SILICA_BASE, dark: SILICA_DARK },
} as const satisfies Readonly<Record<string, GlyphRamp>>;

/** A circle about the box centre. */
export function centreCircle(radius: number): GlyphShape {
  return circle(GLYPH_CENTRE, GLYPH_CENTRE, radius);
}

/** An ellipse about the box centre. */
export function centreEllipse(radiusX: number, radiusY: number): GlyphShape {
  return ellipse(GLYPH_CENTRE, GLYPH_CENTRE, radiusX, radiusY);
}

/** A motion of `kind` at its idle period about (`originX`, `originY`), the centre by default. */
export function motion(kind: GlyphMotionKind, originX = GLYPH_CENTRE, originY = GLYPH_CENTRE): GlyphMotion {
  return { kind, periodMs: GLYPH_PERIOD_MS[kind], originX, originY };
}

export const BREATHE = motion(GLYPH_MOTION.breathe);
export const BEAT = motion(GLYPH_MOTION.beat);
/** Only for parts with no directional light of their own: spines, rings, striae. A turning ramp would turn the light. */
export const SPIN = motion(GLYPH_MOTION.spin);

function withMotion(layer: GlyphLayer, layerMotion: GlyphMotion | undefined): GlyphLayer {
  return layerMotion === undefined ? layer : { ...layer, motion: layerMotion };
}

/** A solid fill. */
export function solid(colour: string, opacity = 1): GlyphFill {
  return { kind: 'solid', colour, opacity };
}

/** A stroke in one colour. */
export function stroke(colour: string, width: number, opacity = 1, dash?: string): GlyphStroke {
  return { colour, width, opacity, ...(dash === undefined ? {} : { dash }) };
}

export interface PaintSpec {
  readonly fill?: GlyphFill;
  readonly stroke?: GlyphStroke;
  readonly motion?: GlyphMotion;
}

/** Any layer: a role, a shape and its paint. */
export function paint(role: GlyphRole, shape: GlyphShape, spec: PaintSpec): GlyphLayer {
  return {
    role,
    shape,
    ...(spec.fill === undefined ? {} : { fill: spec.fill }),
    ...(spec.stroke === undefined ? {} : { stroke: spec.stroke }),
    ...(spec.motion === undefined ? {} : { motion: spec.motion }),
  };
}

/** The glow behind a body: core, soft halo and wide halo in one falloff, never a solid dot. */
export function haloLayer(shape: GlyphShape, colour: string, opacity = GLYPH_HALO_OPACITY): GlyphLayer {
  return { role: GLYPH_ROLE.halo, shape, fill: { kind: 'halo', colour, opacity } };
}

/** The shape moved down-right and filled black: the body's volume, not a drop shadow (there is no ground). */
export function poolLayer(shape: GlyphShape, bodyMotion?: GlyphMotion): GlyphLayer {
  return withMotion(
    {
      role: GLYPH_ROLE.pool,
      shape,
      fill: solid(BLACK, GLYPH_POOL.opacity),
      offset: { x: GLYPH_POOL.offsetX, y: GLYPH_POOL.offsetY },
    },
    bodyMotion,
  );
}

/** The sheet-01 outline under a line or a body: a dark contact line a little wider than what it outlines. */
export function outlineLayer(shape: GlyphShape, width: number, bodyMotion?: GlyphMotion): GlyphLayer {
  return withMotion(
    {
      role: GLYPH_ROLE.outline,
      shape,
      stroke: stroke(OUTLINE, width + GLYPH_OUTLINE.extraWidth, GLYPH_OUTLINE.opacity),
    },
    bodyMotion,
  );
}

export interface BodySpec {
  readonly shape: GlyphShape;
  readonly ramp: GlyphRamp;
  readonly rim: GlyphStroke;
  readonly opacity?: number;
  readonly motion?: GlyphMotion;
}

/** A body: a ramp lit from the top-left with a rim that scatters. */
export function bodyLayer(spec: BodySpec, role: GlyphRole = GLYPH_ROLE.body): GlyphLayer {
  return paint(role, spec.shape, {
    fill: { kind: 'ramp', ramp: spec.ramp, opacity: spec.opacity ?? 1 },
    stroke: spec.rim,
    ...(spec.motion === undefined ? {} : { motion: spec.motion }),
  });
}

/** The pool, outline and body of one shape, in draw order. */
export function shadedBody(spec: BodySpec, role: GlyphRole = GLYPH_ROLE.body): readonly GlyphLayer[] {
  return [
    poolLayer(spec.shape, spec.motion),
    outlineLayer(spec.shape, spec.rim.width, spec.motion),
    bodyLayer(spec, role),
  ];
}

/** A white specular glint at the top-left of a body. */
export function glintLayer(shape: GlyphShape, bodyMotion?: GlyphMotion): GlyphLayer {
  return paint(GLYPH_ROLE.glint, shape, {
    fill: solid(WHITE, GLYPH_GLINT_OPACITY),
    ...(bodyMotion === undefined ? {} : { motion: bodyMotion }),
  });
}
