// The seven concepts (docs/visual-style/ui-type.md §7.2): the rules the other pages link to. A concept is a
// relation, not a thing, so each glyph draws the relation itself — two cells against a caliper, a cell shedding
// what it was, a beam that tips, a helix climbing into a level ring, a rising tally, a cell held against the world's
// line, and the three food kinds together. Every one is two marks at most, so the relation survives at 20 px.

import { DNA_TAG } from '@evolution/shared';
import * as shape from '../svg-glyph';
import { DEPTH_NEAR, DNA_TAG_COLOR, LEVEL_GOLD, LIGHT_ACCENT, SILICA_LIGHT, TEXT_LABEL, WHITE } from './colours';
import {
  SUBJECT_ALPHA,
  SUBJECT_RAMP,
  SUBJECT_STROKE,
  bodyGlint,
  helixLayers,
  rodLayers,
  roundBodyLayers,
  strokedMarkLayers,
  washLayer,
} from './subject-glyph-motifs';
import { ownCellLayers } from './subject-glyph-own-cell';
import { arcPath } from './subject-glyph-shapes';
import * as kit from './trait-glyph-layers';

/** The two cells a comparison needs, and the reach of the mark that compares them. */
const CONCEPT = { bigRadius: 20, smallRadius: 10, washRadius: 36 } as const;

/** A caliper under two cells: mass is size, and size is measured. */
const CALIPER = shape.path('M24 62 L24 72 M76 62 L76 72 M24 68 L76 68 M56 52 L56 68 M32 58 L32 68');
const MASS_AND_SIZE: shape.SubjectGlyph = {
  entryId: 'concept:mass_and_size',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    ...ownCellLayers(28, 48, CONCEPT.smallRadius),
    ...ownCellLayers(54, 36, CONCEPT.bigRadius, kit.BREATHE),
    ...strokedMarkLayers(CALIPER, LIGHT_ACCENT, SUBJECT_STROKE.mark),
  ],
};

/** A cell inside the dashed ghost of what it was, with what it lost falling away: decay is a shrinking. */
const DECAY_FLOOR = shape.path('M30 76 L58 76 M30 72 L30 80 M58 72 L58 80');
const MASS_DECAY: shape.SubjectGlyph = {
  entryId: 'concept:mass_decay',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.paint(shape.GLYPH_ROLE.signature, shape.circle(44, 44, 28), {
      stroke: kit.stroke(TEXT_LABEL, SUBJECT_STROKE.fine, SUBJECT_ALPHA.scatter, '6 5'),
      motion: kit.SPIN,
    }),
    ...ownCellLayers(44, 44, 18, kit.BREATHE),
    /** The floor decay stops at, the starting mass: the measuring mark (§7.2) the shrinking is read against. */
    ...strokedMarkLayers(DECAY_FLOOR, LIGHT_ACCENT, SUBJECT_STROKE.mark),
    kit.paint(
      shape.GLYPH_ROLE.signature,
      shape.path(
        shape.dotsPath(
          [
            [66, 62],
            [74, 70],
            [62, 74],
          ],
          4,
        ),
      ),
      {
        fill: kit.solid(DEPTH_NEAR, SUBJECT_ALPHA.scatter),
        stroke: kit.stroke(SILICA_LIGHT, SUBJECT_STROKE.hair, SUBJECT_ALPHA.wash),
        motion: kit.motion(shape.GLYPH_MOTION.rise, 68, 70),
      },
    ),
  ],
};

/** A beam that has already tipped: whether you may engulf is a threshold, not a contest. */
const BEAM = shape.path('M22 36 L78 48 M50 42 L50 58 M38 74 L62 74 L50 58 Z');
const ENGULF_RATIO: shape.SubjectGlyph = {
  entryId: 'concept:engulf_ratio',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    ...ownCellLayers(34, 34, 12, kit.BREATHE),
    ...roundBodyLayers({
      cx: 76,
      cy: 44,
      radius: 8,
      ramp: SUBJECT_RAMP.rod,
      rim: kit.stroke(WHITE, SUBJECT_STROKE.hair),
    }),
    ...strokedMarkLayers(BEAM, LIGHT_ACCENT, SUBJECT_STROKE.mark),
  ],
};

/** A fragment's helix climbing into the level ring: DNA is what levels are bought with. */
const DNA_AND_LEVELS: shape.SubjectGlyph = {
  entryId: 'concept:dna_and_levels',
  tiltDeg: -28,
  layers: [
    ...helixLayers({
      fromX: 20,
      toX: 66,
      y: 62,
      amplitude: 12,
      waves: 1,
      rungCount: 4,
      rungColour: DNA_TAG_COLOR[DNA_TAG.motile],
      motion: kit.BREATHE,
    }),
    kit.haloLayer(shape.circle(66, 35, 20), LEVEL_GOLD, SUBJECT_ALPHA.halo),
    kit.outlineLayer(shape.circle(66, 35, 13), SUBJECT_STROKE.heavy, kit.BEAT),
    kit.paint(shape.GLYPH_ROLE.signature, shape.circle(66, 35, 13), {
      stroke: kit.stroke(LEVEL_GOLD, SUBJECT_STROKE.heavy),
      motion: kit.BEAT,
    }),
    bodyGlint(66, 35, 14, kit.BEAT),
  ],
};

/**
 * A tally rising left to right on the datum it is counted from, its top bar lit: a score is a number that only goes
 * up, and the datum under the bars is the measuring mark (§7.2) that makes it a count rather than three blocks.
 */
const TALLY = shape.path('M26 68 h13 v-18 h-13 Z M43 68 h13 v-29 h-13 Z M60 68 h13 v-40 h-13 Z');
const TOP_BAR = shape.path('M60 28 h13 v8 h-13 Z');
const SCORE_DATUM = shape.path('M24 72 L76 72 M24 69 L24 75 M76 69 L76 75');
const SCORE: shape.SubjectGlyph = {
  entryId: 'concept:score',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(kit.centreCircle(32), LEVEL_GOLD, SUBJECT_ALPHA.halo),
    kit.poolLayer(TALLY),
    kit.outlineLayer(TALLY, SUBJECT_STROKE.hair),
    kit.paint(shape.GLYPH_ROLE.body, TALLY, {
      fill: { kind: 'ramp', ramp: SUBJECT_RAMP.gold, opacity: 1 },
      stroke: kit.stroke(LEVEL_GOLD, SUBJECT_STROKE.hair),
    }),
    /** The material detail: the score lines the bars are read against, faint. */
    kit.paint(shape.GLYPH_ROLE.detail, shape.path('M24 50 L76 50 M24 38 L76 38'), {
      stroke: kit.stroke(TEXT_LABEL, SUBJECT_STROKE.hair, SUBJECT_ALPHA.faint),
    }),
    ...strokedMarkLayers(SCORE_DATUM, LIGHT_ACCENT, SUBJECT_STROKE.mark),
    kit.paint(shape.GLYPH_ROLE.signature, TOP_BAR, { fill: kit.solid(WHITE, SUBJECT_ALPHA.scatter), motion: kit.BEAT }),
    bodyGlint(32, 56, 10),
  ],
};

/** A cell held above the world's own line: standing is a comparison, so the line is the mark. */
const DATUM = shape.path('M20 60 L80 60 M20 55 L20 65 M80 55 L80 65');
const WORLD_STANDING: shape.SubjectGlyph = {
  entryId: 'concept:world_standing',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    washLayer(CONCEPT.washRadius, LIGHT_ACCENT),
    ...strokedMarkLayers(DATUM, LIGHT_ACCENT, SUBJECT_STROKE.mark),
    ...ownCellLayers(38, 38, 17, kit.BREATHE),
    kit.paint(
      shape.GLYPH_ROLE.signature,
      shape.path(arcPath({ cx: 68, cy: 60, radius: 13, fromTurns: 0.5, toTurns: 1 })),
      {
        fill: kit.solid(TEXT_LABEL, SUBJECT_ALPHA.wash),
        stroke: kit.stroke(TEXT_LABEL, SUBJECT_STROKE.mark, SUBJECT_ALPHA.scatter),
      },
    ),
  ],
};

/**
 * The three food kinds together, the overview page rather than one kind's, and a caliper under the rod: food comes in
 * sizes, and the caliper is the measuring mark (§7.2) the kinds are set against.
 */
const FOOD_CALIPER = shape.path('M30 74 L70 74 M30 70 L30 78 M70 70 L70 78');
const FOOD: shape.SubjectGlyph = {
  entryId: 'concept:food',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(kit.centreCircle(32), SUBJECT_RAMP.algae.base, SUBJECT_ALPHA.wash),
    ...roundBodyLayers({
      cx: 34,
      cy: 34,
      radius: 13,
      ramp: SUBJECT_RAMP.algae,
      rim: kit.stroke(SUBJECT_RAMP.algae.light, SUBJECT_STROKE.fine),
      motion: kit.BREATHE,
    }),
    ...roundBodyLayers({
      cx: 66,
      cy: 37,
      radius: 11,
      ramp: SUBJECT_RAMP.lipid,
      rim: kit.stroke(SUBJECT_RAMP.lipid.light, SUBJECT_STROKE.fine),
      role: shape.GLYPH_ROLE.signature,
    }),
    ...rodLayers({
      cx: 50,
      cy: 59,
      halfLength: 12,
      radius: 7,
      turns: 0.02,
      ramp: SUBJECT_RAMP.rod,
      rim: kit.stroke(SUBJECT_RAMP.rod.light, SUBJECT_STROKE.fine),
      motion: kit.BREATHE,
      role: shape.GLYPH_ROLE.signature,
    }),
    ...strokedMarkLayers(FOOD_CALIPER, LIGHT_ACCENT, SUBJECT_STROKE.mark),
  ],
};

export const CONCEPT_SUBJECT_GLYPHS: readonly shape.SubjectGlyph[] = [
  MASS_AND_SIZE,
  MASS_DECAY,
  ENGULF_RATIO,
  DNA_AND_LEVELS,
  SCORE,
  WORLD_STANDING,
  FOOD,
];
