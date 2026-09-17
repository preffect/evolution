// The motifs the subject glyphs are built from (docs/visual-style/ui-type.md §7.2). Each one returns the layer stack
// ASSET-GENERATION §6 asks for — halo, dark pool, outline, ramped body, signature, glint — for a form several
// subjects share: the mote a food kind is, the rod a bacterium is, the cell a stage is, the helix a fragment is, and
// the arrow every action gesture ends in. A subject's own table then adds only what makes it that subject, which is
// why no two glyph tables repeat a shading stack. Layer roles matter: `detail` is the only role the list LOD drops.

import {
  GLYPH_MOTION,
  GLYPH_ROLE,
  circle,
  dotsPath,
  ellipse,
  path,
  polar,
  type GlyphLayer,
  type GlyphMotion,
  type GlyphRamp,
  type GlyphRole,
  type GlyphShape,
  type GlyphStroke,
} from '../svg-glyph';
import {
  BACTERIUM_PLAIN,
  BG_DEEP,
  BG_FIELD,
  BUBBLE_RIM,
  DANGER,
  DNA_DEEP,
  DNA_STRAND,
  DNA_STRAND_LIGHT,
  FOOD_MOTE,
  FOOD_MOTE_EDGE,
  FOOD_MOTE_RIM,
  LEVEL_GOLD,
  LIGHT_ACCENT,
  LIPID_BASE,
  LIPID_CENTRE,
  LIPID_LIGHT,
  MAGNET_BASE,
  MAGNET_DARK,
  MAGNET_LIGHT,
  PLAYER_PALETTE_TABLE,
  PROTO_FILM,
  SILICA_DARK,
  VENT_CRUST,
  VENT_CRUST_RIM,
  WALL_GLASS,
  WALL_GLASS_INNER,
  WALL_GLASS_OUTER,
  WHITE,
  ZONE_GEL,
  ZONE_SHALLOWS,
  ZONE_VENT,
} from './colours';
import { arrowHeadPath, arrowShaftPath, rodPath, rungsPath, strandPath, type ArrowSpec } from './subject-glyph-shapes';
import {
  GLYPH_CENTRE,
  glintLayer,
  motion,
  haloLayer,
  outlineLayer,
  poolLayer,
  shadedBody,
  solid,
  paint,
  stroke,
} from './trait-glyph-layers';

/** The seat a player cell is drawn in: the first of `PLAYER_PALETTE_TABLE`, so the page always shows seat one. */
const FIRST_SEAT_INDEX = 0;
export const GLYPH_PLAYER_SEAT = PLAYER_PALETTE_TABLE[FIRST_SEAT_INDEX]!;

/**
 * The ramps the subjects are lit with, beside `GLYPH_RAMP`'s organelle families: the food kinds, the DNA strand, the
 * three tinted zones, the dish glass and vent crust, the level gold and the attractor's steel. Every stop is a
 * `colours.ts` name, so a subject glyph paints nothing the dish does not.
 */
export const SUBJECT_RAMP = {
  algae: { light: FOOD_MOTE_RIM, base: FOOD_MOTE, dark: FOOD_MOTE_EDGE },
  lipid: { light: LIPID_LIGHT, base: LIPID_BASE, dark: LIPID_CENTRE },
  dna: { light: DNA_STRAND_LIGHT, base: DNA_STRAND, dark: DNA_DEEP },
  accent: { light: BUBBLE_RIM, base: LIGHT_ACCENT, dark: SILICA_DARK },
  rod: { light: BUBBLE_RIM, base: BACTERIUM_PLAIN, dark: PROTO_FILM },
  shallows: { light: FOOD_MOTE_RIM, base: ZONE_SHALLOWS, dark: SILICA_DARK },
  vent: { light: LIPID_LIGHT, base: ZONE_VENT, dark: VENT_CRUST_RIM },
  gel: { light: DNA_STRAND_LIGHT, base: ZONE_GEL, dark: DNA_DEEP },
  broth: { light: LIGHT_ACCENT, base: BG_FIELD, dark: SILICA_DARK },
  glass: { light: WALL_GLASS_OUTER, base: WALL_GLASS_INNER, dark: WALL_GLASS },
  crust: { light: VENT_CRUST_RIM, base: VENT_CRUST, dark: BG_DEEP },
  gold: { light: WHITE, base: LEVEL_GOLD, dark: VENT_CRUST_RIM },
  danger: { light: LIPID_LIGHT, base: DANGER, dark: DNA_DEEP },
  steel: { light: MAGNET_LIGHT, base: MAGNET_BASE, dark: MAGNET_DARK },
  player: { light: GLYPH_PLAYER_SEAT.rim, base: GLYPH_PLAYER_SEAT.base, dark: SILICA_DARK },
} as const satisfies Readonly<Record<string, GlyphRamp>>;

/**
 * How far from the centre a subject glyph may draw: the frame's radius 47 divided by `GLYPH_LIST_ZOOM` 1.2, so a
 * drawing that fits at the card LOD still fits once the list LOD enlarges it. `subject-glyphs.spec.ts` pins it.
 */
export const GLYPH_MEDALLION_REACH = 39;
/** The line weights a subject glyph draws at: one scale, so no drawing invents a width. */
export const SUBJECT_STROKE = { hair: 1.2, fine: 1.8, rim: 2.2, mark: 3.2, heavy: 4.6 } as const;
/** The alphas the recurring soft passes use: a halo, a wash behind a body, a rim scatter, a faint field. */
export const SUBJECT_ALPHA = { halo: 0.45, wash: 0.3, scatter: 0.7, faint: 0.18 } as const;
/** The glint on a small body: an ellipse this share of the body's radius, up and left of its centre. */
const GLINT = { radiusShareX: 0.42, radiusShareY: 0.22, offsetShare: 0.44, offsetTurns: -0.375 } as const;
/**
 * How far a body's, a helix's or an arrow head's glow reaches past it, as a share of that body. Every glow is sized
 * so the drawing stays inside `GLYPH_MEDALLION_REACH` even after the list LOD enlarges it: the medallion is the
 * stage, and a glyph that spills past its rim reads as a smear on whatever panel is behind it.
 */
const HALO_REACH = { body: 1.7, helix: 2.4, head: 1.1 } as const;
/** A quarter turn anticlockwise: where a rod's lit top sits, the light coming from the top-left. */
const ABOVE_AXIS_TURNS = -0.25;

/** A specular glint sized to the body it sits on, at the top-left where the condenser is. */
export function bodyGlint(centreX: number, centreY: number, radius: number, motion?: GlyphMotion): GlyphLayer {
  const [glintX, glintY] = polar([centreX, centreY], radius * GLINT.offsetShare, GLINT.offsetTurns);
  return glintLayer(ellipse(glintX, glintY, radius * GLINT.radiusShareX, radius * GLINT.radiusShareY), motion);
}

/**
 * A mark laid over a body: outlined first, then stroked in its own colour, so it reads against whatever is under it.
 * Every ability's effect and every concept's measuring instrument is one, which is why neither table draws its own.
 */
export function strokedMarkLayers(
  drawing: GlyphShape,
  colour: string,
  width: number,
  motion?: GlyphMotion,
): readonly GlyphLayer[] {
  return [
    outlineLayer(drawing, width, motion),
    paint(GLYPH_ROLE.signature, drawing, {
      stroke: stroke(colour, width),
      ...(motion === undefined ? {} : { motion }),
    }),
  ];
}

/**
 * A solid mark laid over the field: outlined, then filled with a lit ramp and rimmed in its light. Every crescent a
 * mouth, a shield, a grip or a horseshoe is drawn as is one, so no table repeats the fill-and-rim pair.
 */
export function rampedMarkLayers(drawing: GlyphShape, ramp: GlyphRamp, motion?: GlyphMotion): readonly GlyphLayer[] {
  const withMotion = motion === undefined ? {} : { motion };
  return [
    outlineLayer(drawing, SUBJECT_STROKE.hair, motion),
    paint(GLYPH_ROLE.signature, drawing, {
      fill: { kind: 'ramp', ramp, opacity: 1 },
      stroke: stroke(ramp.light, SUBJECT_STROKE.hair),
      ...withMotion,
    }),
  ];
}

export interface RoundBodySpec {
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  readonly ramp: GlyphRamp;
  readonly rim: GlyphStroke;
  readonly motion?: GlyphMotion;
  /** What the lit body counts as: `body` by default, `signature` where the form itself is what names the subject. */
  readonly role?: GlyphRole;
  /** Under 1 the body reads as a film rather than a solid: a protocell, a zone tint, a bubble. */
  readonly opacity?: number;
}

/** A halo, a shaded round body and its glint: the mote a food kind is, and the bead a cell is at small sizes. */
export function roundBodyLayers(spec: RoundBodySpec, haloShare: number = HALO_REACH.body): readonly GlyphLayer[] {
  return [
    haloLayer(circle(spec.cx, spec.cy, spec.radius * haloShare), spec.ramp.base, SUBJECT_ALPHA.halo),
    ...shadedBody(
      {
        shape: circle(spec.cx, spec.cy, spec.radius),
        ramp: spec.ramp,
        rim: spec.rim,
        ...(spec.opacity === undefined ? {} : { opacity: spec.opacity }),
        ...(spec.motion === undefined ? {} : { motion: spec.motion }),
      },
      spec.role,
    ),
    bodyGlint(spec.cx, spec.cy, spec.radius, spec.motion),
  ];
}

export interface RodBodySpec {
  readonly cx: number;
  readonly cy: number;
  readonly halfLength: number;
  readonly radius: number;
  readonly turns: number;
  readonly ramp: GlyphRamp;
  readonly rim: GlyphStroke;
  readonly motion?: GlyphMotion;
  readonly role?: GlyphRole;
}

/** A halo, a shaded stadium rod and the sheen along its lit top: how a bacterium is drawn in the dish. */
export function rodLayers(spec: RodBodySpec): readonly GlyphLayer[] {
  const shape = path(rodPath(spec));
  const sheenOffset = spec.radius * GLINT.offsetShare;
  const [sheenX, sheenY] = polar([spec.cx, spec.cy], sheenOffset, spec.turns + ABOVE_AXIS_TURNS);
  return [
    haloLayer(circle(spec.cx, spec.cy, spec.halfLength + spec.radius), spec.ramp.base, SUBJECT_ALPHA.halo),
    ...shadedBody(
      {
        shape,
        ramp: spec.ramp,
        rim: spec.rim,
        ...(spec.motion === undefined ? {} : { motion: spec.motion }),
      },
      spec.role,
    ),
    glintLayer(ellipse(sheenX, sheenY, spec.halfLength * GLINT.radiusShareX, spec.radius * GLINT.radiusShareY)),
  ];
}

export interface HelixSpec {
  readonly fromX: number;
  readonly toX: number;
  readonly y: number;
  readonly amplitude: number;
  readonly waves: number;
  readonly rungCount: number;
  /** The tag colour the rungs carry; the strands are always the DNA pair. */
  readonly rungColour: string;
  readonly motion?: GlyphMotion;
}

const HELIX_PHASE = { front: 0, back: 0.5 } as const;

/** How solid the lens the two strands enclose reads: enough to carry a lit ramp, not enough to hide the rungs. */
const HELIX_LENS_OPACITY = 0.4;

/**
 * The two crossing strands, the lit lens they enclose and their rungs: what a DNA fragment is, and the cartouche
 * every DNA tag sits in. The lens is what gives the drawing volume — two strokes alone would be a flat wire diagram.
 */
export function helixLayers(spec: HelixSpec): readonly GlyphLayer[] {
  const strand = (phaseTurns: number): string => strandPath({ ...spec, phaseTurns });
  const rungs = path(rungsPath({ ...spec, phaseTurns: HELIX_PHASE.front, count: spec.rungCount }));
  const withMotion = spec.motion === undefined ? {} : { motion: spec.motion };
  const centreX = (spec.fromX + spec.toX) / 2;
  const lens = ellipse(centreX, spec.y, (spec.toX - spec.fromX) / 2, spec.amplitude);
  return [
    haloLayer(circle(centreX, spec.y, spec.amplitude * HALO_REACH.helix), spec.rungColour, SUBJECT_ALPHA.halo),
    ...shadedBody({
      shape: lens,
      ramp: SUBJECT_RAMP.dna,
      rim: stroke(DNA_STRAND_LIGHT, SUBJECT_STROKE.hair, SUBJECT_ALPHA.wash),
      opacity: HELIX_LENS_OPACITY,
      ...withMotion,
    }),
    outlineLayer(path(strand(HELIX_PHASE.back)), SUBJECT_STROKE.fine, spec.motion),
    paint(GLYPH_ROLE.body, path(strand(HELIX_PHASE.back)), {
      stroke: stroke(DNA_STRAND, SUBJECT_STROKE.fine),
      ...withMotion,
    }),
    paint(GLYPH_ROLE.signature, rungs, { stroke: stroke(spec.rungColour, SUBJECT_STROKE.mark), ...withMotion }),
    paint(GLYPH_ROLE.body, path(strand(HELIX_PHASE.front)), {
      stroke: stroke(DNA_STRAND_LIGHT, SUBJECT_STROKE.fine),
      ...withMotion,
    }),
  ];
}

/** How far past its head an arrow's glint sits, as a share of the head: the lit facet of a solid mark. */
const ARROW_GLINT_SHARE = 0.3;

/**
 * The gesture every action glyph carries and no ability glyph does (§7.2): an outlined shaft ending in a solid,
 * ramped head. The head is the `signature` layer, so it survives the list LOD, where the verb is all that is left.
 */
export function arrowLayers(spec: ArrowSpec, ramp: GlyphRamp, motion?: GlyphMotion): readonly GlyphLayer[] {
  const shaft = path(arrowShaftPath(spec));
  const head = path(arrowHeadPath(spec));
  const withMotion = motion === undefined ? {} : { motion };
  return [
    haloLayer(circle(spec.toX, spec.toY, spec.headLength * HALO_REACH.head), ramp.base, SUBJECT_ALPHA.halo),
    outlineLayer(shaft, SUBJECT_STROKE.mark, motion),
    paint(GLYPH_ROLE.body, shaft, { stroke: stroke(ramp.base, SUBJECT_STROKE.mark), ...withMotion }),
    poolLayer(head, motion),
    outlineLayer(head, SUBJECT_STROKE.hair, motion),
    paint(GLYPH_ROLE.signature, head, {
      fill: { kind: 'ramp', ramp, opacity: 1 },
      stroke: stroke(ramp.light, SUBJECT_STROKE.hair, SUBJECT_ALPHA.scatter),
      ...withMotion,
    }),
    glintLayer(
      ellipse(
        spec.toX - spec.headLength * ARROW_GLINT_SHARE,
        spec.toY - spec.headLength * ARROW_GLINT_SHARE,
        spec.headLength * GLINT.radiusShareY,
        spec.headLength * GLINT.radiusShareY,
      ),
      motion,
    ),
  ];
}

/**
 * The depth motes that drift through the broth (`dish/depth-particles.ts`): dots of one size at listed centres, all
 * rising together on one slow loop. The dish and the open broth both show them, so neither table draws its own.
 */
export function driftingMotesLayer(
  centres: readonly (readonly [number, number])[],
  dotRadius: number,
  colour: string,
  role: GlyphRole = GLYPH_ROLE.signature,
): GlyphLayer {
  return paint(role, path(dotsPath(centres, dotRadius)), {
    fill: solid(colour, SUBJECT_ALPHA.scatter),
    motion: motion(GLYPH_MOTION.rise, GLYPH_CENTRE, GLYPH_CENTRE),
  });
}

/** A faint wash behind a drawing: the zone tint a subject sits in, the field a dish topic is seen against. */
export function washLayer(radius: number, colour: string, centreX = GLYPH_CENTRE, centreY = GLYPH_CENTRE): GlyphLayer {
  return paint(GLYPH_ROLE.halo, circle(centreX, centreY, radius), { fill: solid(colour, SUBJECT_ALPHA.faint) });
}
