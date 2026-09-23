// The seven DNA tags (docs/visual-style/ui-type.md §7.2). A tag is not a trait and not an organelle, so every tag
// glyph sits in the same cartouche — the lens two crossing DNA strands make — and carries one bold motif inside it in
// that tag's `DNA_TAG_COLOR`. The cartouche is the family mark: it keeps a tag apart from the trait glyph that grants
// it (metabolic against Mitochondrion, photic against Chloroplast) even at 20 px, where only the outline survives.

import { DNA_TAG } from '@evolution/shared';
import * as shape from '../svg-glyph';
import { DNA_DEEP, DNA_STRAND, DNA_STRAND_LIGHT, DNA_TAG_COLOR } from './colours';
import { SUBJECT_ALPHA, SUBJECT_STROKE, bodyGlint } from './subject-glyph-motifs';
import { crescentPath, rungsPath, strandPath } from './subject-glyph-shapes';
import * as kit from './trait-glyph-layers';

/** The lens the two strands make, and the box a motif is drawn inside it. */
const CARTOUCHE = {
  fromX: 18,
  toX: 82,
  y: 50,
  amplitude: 22,
  /** Half a wave: the strands cross at the two ends only, so the lens holds one motif instead of three pinches. */
  waves: 0.5,
  haloRadius: 34,
} as const;
/** The rungs the cartouche's strand pair holds, its material detail. */
const CARTOUCHE_RUNG_COUNT = 5;

const LENS_TOP = shape.path(strandPath({ ...CARTOUCHE, phaseTurns: 0 }));
const LENS_BOTTOM = shape.path(strandPath({ ...CARTOUCHE, phaseTurns: 0.5 }));
const CARTOUCHE_RUNGS = shape.path(rungsPath({ ...CARTOUCHE, phaseTurns: 0, count: CARTOUCHE_RUNG_COUNT }));

/** How solid the lens reads behind its motif: lit enough to have volume, quiet enough to stay a frame. */
const LENS_OPACITY = 0.38;
const LENS_BODY = shape.ellipse(50, CARTOUCHE.y, (CARTOUCHE.toX - CARTOUCHE.fromX) / 2, CARTOUCHE.amplitude);

/** The cartouche: the tag's glow, its lit lens, the strand pair that closes it and the glint on its lit shoulder. */
function cartoucheLayers(colour: string): readonly shape.GlyphLayer[] {
  return [
    kit.haloLayer(kit.centreCircle(CARTOUCHE.haloRadius), colour, SUBJECT_ALPHA.halo),
    ...kit.shadedBody({
      shape: LENS_BODY,
      ramp: { light: DNA_STRAND_LIGHT, base: colour, dark: DNA_DEEP },
      rim: kit.stroke(DNA_STRAND, SUBJECT_STROKE.hair, SUBJECT_ALPHA.wash),
      opacity: LENS_OPACITY,
    }),
    kit.outlineLayer(LENS_TOP, SUBJECT_STROKE.fine),
    kit.outlineLayer(LENS_BOTTOM, SUBJECT_STROKE.fine),
    kit.paint(shape.GLYPH_ROLE.body, LENS_BOTTOM, { stroke: kit.stroke(DNA_STRAND, SUBJECT_STROKE.rim) }),
    kit.paint(shape.GLYPH_ROLE.body, LENS_TOP, { stroke: kit.stroke(DNA_STRAND_LIGHT, SUBJECT_STROKE.rim) }),
    // The material detail: the rungs the strand pair holds, faint behind the motif, dropped at the list LOD.
    kit.paint(shape.GLYPH_ROLE.detail, CARTOUCHE_RUNGS, {
      stroke: kit.stroke(DNA_STRAND_LIGHT, SUBJECT_STROKE.hair, SUBJECT_ALPHA.faint),
    }),
    bodyGlint(36, 40, 11),
  ];
}

/** One tag: the cartouche, then the motif that names it, drawn in the tag's own colour. */
function tagGlyph(tag: keyof typeof DNA_TAG_COLOR, motif: readonly shape.GlyphLayer[]): shape.SubjectGlyph {
  return {
    entryId: `dna_tag:${tag}`,
    tiltDeg: kit.GLYPH_NO_TILT,
    layers: [...cartoucheLayers(DNA_TAG_COLOR[tag]), ...motif],
  };
}

/** A motif, outlined so it holds against the lens behind it, then painted in the tag's own colour. */
function motifLayers(drawing: shape.GlyphShape, spec: kit.PaintSpec): readonly shape.GlyphLayer[] {
  return [
    kit.outlineLayer(drawing, SUBJECT_STROKE.mark, spec.motion),
    kit.paint(shape.GLYPH_ROLE.signature, drawing, spec),
  ];
}

const TAIL_WAG = kit.motion(shape.GLYPH_MOTION.sway, 38, 50);
const MOTILE = tagGlyph(
  DNA_TAG.motile,
  motifLayers(shape.path('M34 50 C46 38 54 62 66 50'), {
    stroke: kit.stroke(DNA_TAG_COLOR[DNA_TAG.motile], SUBJECT_STROKE.heavy),
    motion: TAIL_WAG,
  }),
);

const PHOTIC = tagGlyph(
  DNA_TAG.photic,
  motifLayers(
    shape.path(
      shape.radialStrokesPath({
        ...kit.GLYPH_CENTRE_POINT,
        count: 6,
        innerRadius: 11,
        outerRadius: 21,
        leanTurns: 0,
        phaseTurns: 0.04,
      }),
    ),
    { stroke: kit.stroke(DNA_TAG_COLOR[DNA_TAG.photic], SUBJECT_STROKE.mark), motion: kit.BREATHE },
  ),
);

/** Predation is a mouth closing on prey: an open crescent with a bead inside its bite. */
const PREDATORY = tagGlyph(
  DNA_TAG.predatory,
  motifLayers(shape.path(crescentPath({ cx: 46, cy: 50, radius: 19, thickness: 7, fromTurns: 0.12, toTurns: 0.88 })), {
    fill: kit.solid(DNA_TAG_COLOR[DNA_TAG.predatory]),
    motion: kit.BEAT,
  }),
);

const ARMORED = tagGlyph(
  DNA_TAG.armored,
  motifLayers(shape.path(shape.polygonPath({ ...kit.GLYPH_CENTRE_POINT, sides: 6, radius: 18, phaseTurns: 0 })), {
    stroke: kit.stroke(DNA_TAG_COLOR[DNA_TAG.armored], SUBJECT_STROKE.heavy),
    motion: kit.BREATHE,
  }),
);

/** A bladder with two wisps leaving it: the toxin cloud, at the size a 20 px glyph can still show. */
const TOXIC = tagGlyph(
  DNA_TAG.toxic,
  motifLayers(shape.path('M50 32 C60 44 63 54 56 62 C50 68 44 66 42 58 C40 50 44 40 50 32 Z'), {
    fill: kit.solid(DNA_TAG_COLOR[DNA_TAG.toxic]),
    motion: kit.BEAT,
  }),
);

/** The eyespot: a bright dot behind a shading cup, which is how a cell tells light from dark. */
const SENSORY = tagGlyph(
  DNA_TAG.sensory,
  motifLayers(shape.path('M36 50 A14 14 0 1 1 64 50 A14 14 0 1 1 36 50 M50 44 A6 6 0 1 0 50 56 A6 6 0 1 0 50 44'), {
    fill: kit.solid(DNA_TAG_COLOR[DNA_TAG.sensory]),
    motion: kit.BEAT,
  }),
);

/** The bean and its three cristae: the shape every metabolic trait grows toward. */
const METABOLIC = tagGlyph(
  DNA_TAG.metabolic,
  motifLayers(
    shape.path(
      'M34 44 C42 34 60 34 66 44 C72 54 64 66 52 64 C44 63 44 56 50 54 C56 52 58 46 52 44 C46 42 38 46 34 44 Z',
    ),
    { fill: kit.solid(DNA_TAG_COLOR[DNA_TAG.metabolic]), motion: kit.BEAT },
  ),
);

export const DNA_TAG_SUBJECT_GLYPHS: readonly shape.SubjectGlyph[] = [
  MOTILE,
  PHOTIC,
  PREDATORY,
  ARMORED,
  TOXIC,
  SENSORY,
  METABOLIC,
];
