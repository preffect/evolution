// The field marks the subject glyphs share (docs/visual-style/ui-type.md §7.2): the depth motes of the broth, a ring
// of studs or pores about the centre, and the faint wash a subject is seen against. Split out of
// `subject-glyph-motifs.ts`, which re-exports them, so no table's imports change.

import {
  GLYPH_MOTION,
  GLYPH_ROLE,
  circle,
  dotRingPath,
  dotsPath,
  path,
  type GlyphLayer,
  type GlyphMotion,
  type GlyphRole,
} from '../svg-glyph';
import { SUBJECT_ALPHA, SUBJECT_STROKE } from './subject-glyph-palette';
import { GLYPH_CENTRE, motion, paint, solid, stroke } from './trait-glyph-layers';

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

export interface StudRingSpec {
  readonly count: number;
  readonly ringRadius: number;
  readonly dotRadius: number;
  readonly phaseTurns: number;
  readonly colour: string;
  /** An outline round each dot, for studs that have to stand off the body they sit on. */
  readonly rimColour?: string;
  readonly motion?: GlyphMotion;
}

/** A ring of dots about the medallion's centre: a prokaryote's ribosome studs, a nuclear envelope's pores. */
export function studRingLayer(spec: StudRingSpec, role: GlyphRole = GLYPH_ROLE.signature): GlyphLayer {
  return paint(
    role,
    path(
      dotRingPath({
        cx: GLYPH_CENTRE,
        cy: GLYPH_CENTRE,
        count: spec.count,
        ringRadius: spec.ringRadius,
        dotRadius: spec.dotRadius,
        phaseTurns: spec.phaseTurns,
      }),
    ),
    {
      fill: solid(spec.colour),
      ...(spec.rimColour === undefined ? {} : { stroke: stroke(spec.rimColour, SUBJECT_STROKE.hair) }),
      ...(spec.motion === undefined ? {} : { motion: spec.motion }),
    },
  );
}

/** A faint wash behind a drawing: the zone tint a subject sits in, the field a dish topic is seen against. */
export function washLayer(radius: number, colour: string, centreX = GLYPH_CENTRE, centreY = GLYPH_CENTRE): GlyphLayer {
  return paint(GLYPH_ROLE.halo, circle(centreX, centreY, radius), { fill: solid(colour, SUBJECT_ALPHA.faint) });
}
