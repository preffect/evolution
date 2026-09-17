// The abilities a cell reaches past itself with (docs/visual-style/ui-type.md §7.2): the light it catches, the spines
// and the toxin that keep others off, the food it pulls in, the genome it keeps and the gel it shrugs off. The family
// rules are `subject-glyphs-abilities-contest.ts`'s: an organ or an effect on a cell, in its own organelle colours,
// and never an arrowhead. These six separate on silhouette: rays, spikes, wisps, a horseshoe, a ring, parted strands.

import * as shape from '../svg-glyph';
import { CHLORO_LIGHT, CYTOSKELETON, DNA_STRAND_LIGHT, SILICA_LIGHT, TOXIN_GLOW, TOXIN_RIM, ZONE_GEL } from './colours';
import {
  SUBJECT_ALPHA,
  SUBJECT_RAMP,
  SUBJECT_STROKE,
  bodyGlint,
  rampedMarkLayers,
  roundBodyLayers,
  strokedMarkLayers,
  washLayer,
} from './subject-glyph-motifs';
import { crescentPath, lobedPath, strandPath } from './subject-glyph-shapes';
import * as kit from './trait-glyph-layers';

/** The bead an ability acts on, and the reach of the mark around it — the contest table's sizes, shared. */
const ABILITY = { beadRadius: 15, bigBeadRadius: 20, reach: 34, washRadius: 36 } as const;

/** Light arriving from the top-left, where the condenser is, and a lens that catches it. */
const RAYS = shape.path('M24 28 L36 40 M38 22 L46 32 M22 40 L32 46');
const PHOTOSYNTHESIS: shape.SubjectGlyph = {
  entryId: 'ability:photosynthesis',
  tiltDeg: 16,
  layers: [
    ...strokedMarkLayers(RAYS, CHLORO_LIGHT, SUBJECT_STROKE.mark, kit.BREATHE),
    ...roundBodyLayers({
      cx: 56,
      cy: 56,
      radius: ABILITY.bigBeadRadius,
      ramp: kit.GLYPH_RAMP.chloroplast,
      rim: kit.stroke(CHLORO_LIGHT, SUBJECT_STROKE.rim),
      motion: kit.BREATHE,
    }),
    kit.paint(
      shape.GLYPH_ROLE.detail,
      shape.path(shape.dotRingPath({ cx: 56, cy: 56, count: 6, ringRadius: 13, dotRadius: 2.8, phaseTurns: 0.08 })),
      { fill: kit.solid(CHLORO_LIGHT, SUBJECT_ALPHA.scatter), motion: kit.BREATHE },
    ),
  ],
};

const SPIKES = shape.path(
  shape.radialStrokesPath({
    ...kit.GLYPH_CENTRE_POINT,
    count: 8,
    innerRadius: 12,
    outerRadius: 34,
    leanTurns: 0,
    phaseTurns: 0.06,
  }),
);
const SPINES: shape.SubjectGlyph = {
  entryId: 'ability:spines',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    ...strokedMarkLayers(SPIKES, SILICA_LIGHT, SUBJECT_STROKE.mark, kit.SPIN),
    ...roundBodyLayers({
      cx: 50,
      cy: 50,
      radius: ABILITY.beadRadius,
      ramp: kit.GLYPH_RAMP.silica,
      rim: kit.stroke(SILICA_LIGHT, SUBJECT_STROKE.rim),
      motion: kit.BREATHE,
    }),
  ],
};

/**
 * Toxin is drawn as what the aura *does*, not as the organ that carries it: the Toxin Vacuole trait glyph already
 * owns the bladder-and-tendrils silhouette, and a second magenta ball with purple wisps beside it in the same
 * encyclopedia was the tightest collision in the set. So: the toxic cell, the haze it sits in, and a second cell
 * caught in it — eroded at the edge, with the drain pulling inward. Two bodies read as two bodies at 20 px.
 */
const TOXIN_VICTIM = shape.path(lobedPath({ cx: 64, cy: 54, radius: 12, lobes: 7, lobeDepth: 2.4, phaseTurns: 0.1 }));
const TOXIN_DRAIN = shape.path(
  shape.radialStrokesPath({
    cx: 64,
    cy: 54,
    count: 6,
    innerRadius: 15,
    outerRadius: 19,
    leanTurns: 0,
    phaseTurns: 0.03,
  }),
);
const TOXIN: shape.SubjectGlyph = {
  entryId: 'ability:toxin',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    washLayer(ABILITY.washRadius, TOXIN_GLOW),
    ...kit.shadedBody({
      shape: TOXIN_VICTIM,
      ramp: SUBJECT_RAMP.rod,
      rim: kit.stroke(TOXIN_RIM, SUBJECT_STROKE.fine, SUBJECT_ALPHA.scatter),
      opacity: 0.7,
      motion: kit.BREATHE,
    }),
    ...strokedMarkLayers(TOXIN_DRAIN, TOXIN_GLOW, SUBJECT_STROKE.mark, kit.BEAT),
    ...roundBodyLayers({
      cx: 34,
      cy: 44,
      radius: 14,
      ramp: kit.GLYPH_RAMP.toxin,
      rim: kit.stroke(TOXIN_RIM, SUBJECT_STROKE.rim),
      motion: kit.BEAT,
    }),
  ],
};

/** A steel horseshoe with two motes drawn into its gap: food that comes to the cell. */
const HORSESHOE = shape.path(
  crescentPath({ cx: 50, cy: 50, radius: 28, thickness: 10, fromTurns: 0.62, toTurns: 1.38 }),
);
const FOOD_ATTRACTION: shape.SubjectGlyph = {
  entryId: 'ability:food_attraction',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(kit.centreCircle(ABILITY.reach), SUBJECT_RAMP.algae.base, SUBJECT_ALPHA.wash),
    ...rampedMarkLayers(HORSESHOE, SUBJECT_RAMP.steel, kit.BREATHE),
    ...roundBodyLayers({
      cx: 62,
      cy: 34,
      radius: 7,
      ramp: SUBJECT_RAMP.algae,
      rim: kit.stroke(SUBJECT_RAMP.algae.light, SUBJECT_STROKE.hair),
      motion: kit.motion(shape.GLYPH_MOTION.rise, 62, 34),
    }),
    ...roundBodyLayers({
      cx: 64,
      cy: 68,
      radius: 6,
      ramp: SUBJECT_RAMP.algae,
      rim: kit.stroke(SUBJECT_RAMP.algae.light, SUBJECT_STROKE.hair),
      motion: kit.motion(shape.GLYPH_MOTION.rise, 64, 68),
    }),
  ],
};

/** A closed plasmid, not a loose fragment: the genome a cell keeps, with its rungs standing off the ring. */
const PLASMID_RUNGS = shape.path(
  shape.radialStrokesPath({
    ...kit.GLYPH_CENTRE_POINT,
    count: 14,
    innerRadius: 18,
    outerRadius: 27,
    leanTurns: 0.03,
    phaseTurns: 0,
  }),
);
const GENOME: shape.SubjectGlyph = {
  entryId: 'ability:genome',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(kit.centreCircle(ABILITY.reach), SUBJECT_RAMP.dna.base, SUBJECT_ALPHA.halo),
    ...strokedMarkLayers(PLASMID_RUNGS, DNA_STRAND_LIGHT, SUBJECT_STROKE.fine, kit.SPIN),
    /** The nucleoid the plasmid rides in: the lit body a ring of strokes would not have. */
    ...kit.shadedBody({
      shape: kit.centreCircle(22),
      ramp: SUBJECT_RAMP.dna,
      rim: kit.stroke(SUBJECT_RAMP.dna.base, SUBJECT_STROKE.heavy),
      opacity: 0.45,
    }),
    /** The plasmid itself: a closed loop, which is what tells a genome from the loose fragment of `entity:`. */
    kit.paint(shape.GLYPH_ROLE.signature, kit.centreCircle(17), {
      stroke: kit.stroke(DNA_STRAND_LIGHT, SUBJECT_STROKE.mark),
      motion: kit.SPIN,
    }),
    bodyGlint(50, 50, 24),
  ],
};

/** Four gel strands parting round a cell that keeps its speed: the mire that does not hold it. */
const GEL_STRANDS = shape.path(
  [-1, 1]
    .flatMap((side) =>
      [13, 23].map((offset) =>
        strandPath({ fromX: 27, toX: 73, y: 50 + side * offset, amplitude: 4, waves: 1.5, phaseTurns: side * 0.25 }),
      ),
    )
    .join(' '),
);
const GEL_RESISTANCE: shape.SubjectGlyph = {
  entryId: 'ability:gel_resistance',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    washLayer(ABILITY.washRadius, ZONE_GEL),
    ...strokedMarkLayers(GEL_STRANDS, ZONE_GEL, SUBJECT_STROKE.mark, kit.motion(shape.GLYPH_MOTION.sway)),
    ...roundBodyLayers({
      cx: 50,
      cy: 50,
      radius: ABILITY.beadRadius,
      ramp: SUBJECT_RAMP.accent,
      rim: kit.stroke(CYTOSKELETON, SUBJECT_STROKE.rim),
      motion: kit.BREATHE,
    }),
  ],
};

export const REACH_ABILITY_GLYPHS: readonly shape.SubjectGlyph[] = [
  PHOTOSYNTHESIS,
  SPINES,
  TOXIN,
  FOOD_ATTRACTION,
  GENOME,
  GEL_RESISTANCE,
];
