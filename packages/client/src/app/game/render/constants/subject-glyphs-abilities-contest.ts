// The abilities a cell contests with (docs/visual-style/ui-type.md §7.2): how it moves, how it holds or refuses a
// hold, and what it digests once it has one. An ability is a thing a cell has, so every ability glyph draws the organ
// or the effect on a cell, in that ability's organelle colours, and **never carries an arrowhead** — that mark belongs
// to the actions (`subject-glyphs-actions.ts`). At 20 px the two families are told apart by that one rule, and these
// five from each other by silhouette: a dotted track, a chevron fan, a double shell, a closed mouth, a bubble.

import * as shape from '../svg-glyph';
import { LIGHT_ACCENT, MITO_LIGHT, SILICA_LIGHT, WHITE } from './colours';
import {
  SUBJECT_ALPHA,
  SUBJECT_RAMP,
  SUBJECT_STROKE,
  rampedMarkLayers,
  roundBodyLayers,
  strokedMarkLayers,
} from './subject-glyph-motifs';
import { crescentPath } from './subject-glyph-shapes';
import * as kit from './trait-glyph-layers';

/** The bead an ability acts on, and the reach of the mark around it. */
const ABILITY = {
  beadRadius: 15,
  bigBeadRadius: 20,
  preyRadius: 8,
  gripBodyRadius: 21,
  reach: 34,
  washRadius: 36,
} as const;

/**
 * Movement is speed *held*, where a sprint is speed spent — so the cell trails the wake it has already made. Drawn
 * as three solid beads shrinking behind it, not as a dashed line: the list LOD keeps dash gaps open (a pore has to
 * stay a pore), so a 3-unit mark against a 6-unit gap comes to well under a pixel at 20 px and simply vanishes.
 */
const MOVEMENT_TRAIL: readonly (readonly [number, number, number])[] = [
  [48, 55, 8],
  [33, 61, 5.5],
  [21, 66, 3.5],
];
const MOVEMENT: shape.SubjectGlyph = {
  entryId: 'ability:movement',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(shape.circle(48, 52, 34), LIGHT_ACCENT, SUBJECT_ALPHA.wash),
    ...MOVEMENT_TRAIL.flatMap(([centreX, centreY, radius], index) => [
      kit.outlineLayer(shape.circle(centreX, centreY, radius), SUBJECT_STROKE.hair),
      kit.paint(shape.GLYPH_ROLE.signature, shape.circle(centreX, centreY, radius), {
        fill: kit.solid(LIGHT_ACCENT, SUBJECT_ALPHA.scatter - index * 0.18),
      }),
    ]),
    ...roundBodyLayers({
      cx: 64,
      cy: 44,
      radius: ABILITY.beadRadius,
      ramp: SUBJECT_RAMP.accent,
      rim: kit.stroke(LIGHT_ACCENT, SUBJECT_STROKE.rim),
      motion: kit.BREATHE,
    }),
  ],
};

/** Two hard chevrons, not soft arcs: a burst spent, where movement is speed held. */
const CHEVRONS = shape.path('M70 34 L84 50 L70 66 M56 34 L70 50 L56 66');
const SPRINT: shape.SubjectGlyph = {
  entryId: 'ability:sprint',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    ...roundBodyLayers({
      cx: 34,
      cy: 50,
      radius: ABILITY.beadRadius,
      ramp: SUBJECT_RAMP.vent,
      rim: kit.stroke(MITO_LIGHT, SUBJECT_STROKE.rim),
      motion: kit.BEAT,
    }),
    ...strokedMarkLayers(CHEVRONS, MITO_LIGHT, SUBJECT_STROKE.heavy, kit.BEAT),
  ],
};

/** Two shells, one inside the other, on the lit side of the cell: the membrane that refuses to be wrapped. */
const SHIELD = shape.path(
  [
    crescentPath({ cx: 52, cy: 50, radius: 37, thickness: 7, fromTurns: 0.3, toTurns: 0.7 }),
    crescentPath({ cx: 52, cy: 50, radius: 27, thickness: 5, fromTurns: 0.34, toTurns: 0.66 }),
  ].join(' '),
);
const ENGULF_DEFENCE: shape.SubjectGlyph = {
  entryId: 'ability:engulf_defence',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    ...roundBodyLayers({
      cx: 54,
      cy: 50,
      radius: ABILITY.bigBeadRadius,
      ramp: kit.GLYPH_RAMP.silica,
      rim: kit.stroke(SILICA_LIGHT, SUBJECT_STROKE.rim),
      motion: kit.BREATHE,
    }),
    ...rampedMarkLayers(SHIELD, kit.GLYPH_RAMP.silica, kit.BREATHE),
  ],
};

/** A mouth already closed most of the way round its prey: grip, not the act of engulfing. */
const GRIP = shape.path(crescentPath({ cx: 44, cy: 50, radius: 30, thickness: 9, fromTurns: 0.06, toTurns: 0.94 }));
const ENGULF_GRIP: shape.SubjectGlyph = {
  entryId: 'ability:engulf_grip',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    /** The predator whose grip it is: its body, filmy so the prey reads inside it (§7.2, an effect on a cell). */
    ...roundBodyLayers({
      cx: 44,
      cy: 50,
      radius: ABILITY.gripBodyRadius,
      ramp: kit.GLYPH_RAMP.vacuole,
      rim: kit.stroke(kit.GLYPH_RAMP.vacuole.light, SUBJECT_STROKE.hair, SUBJECT_ALPHA.wash),
      opacity: 0.45,
    }),
    ...roundBodyLayers({
      cx: 52,
      cy: 50,
      radius: ABILITY.preyRadius,
      ramp: SUBJECT_RAMP.rod,
      rim: kit.stroke(WHITE, SUBJECT_STROKE.hair),
      motion: kit.BEAT,
    }),
    ...rampedMarkLayers(GRIP, kit.GLYPH_RAMP.vacuole, kit.BEAT),
  ],
};

/** A food vacuole with a mote breaking up inside it: the dashed rim is the prey losing its edge. */
const DIGESTION: shape.SubjectGlyph = {
  entryId: 'ability:digestion',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    ...roundBodyLayers({
      cx: 50,
      cy: 50,
      radius: ABILITY.bigBeadRadius + 4,
      ramp: kit.GLYPH_RAMP.vacuole,
      rim: kit.stroke(kit.GLYPH_RAMP.vacuole.light, SUBJECT_STROKE.rim),
      motion: kit.BREATHE,
      opacity: 0.55,
    }),
    kit.paint(shape.GLYPH_ROLE.signature, kit.centreCircle(11), {
      fill: kit.solid(SUBJECT_RAMP.algae.base),
      stroke: kit.stroke(SUBJECT_RAMP.algae.light, SUBJECT_STROKE.mark, 1, '5 5'),
      motion: kit.BEAT,
    }),
    kit.paint(
      shape.GLYPH_ROLE.detail,
      shape.path(
        shape.dotsPath(
          [
            [38, 62],
            [63, 39],
            [62, 61],
          ],
          2.6,
        ),
      ),
      { fill: kit.solid(SUBJECT_RAMP.algae.light), motion: kit.BEAT },
    ),
  ],
};

export const CONTEST_ABILITY_GLYPHS: readonly shape.SubjectGlyph[] = [
  MOVEMENT,
  SPRINT,
  ENGULF_DEFENCE,
  ENGULF_GRIP,
  DIGESTION,
];
