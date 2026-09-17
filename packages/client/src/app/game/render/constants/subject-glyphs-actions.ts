// The eight actions (docs/visual-style/ui-type.md §7.2). An action is something the player does, so every action
// glyph is a **gesture**: a bold arrow in the accent, or in the colour of what the verb acts on, with the thing it
// acts on drawn small beside it. The arrowhead is the family mark — no ability glyph has one — and the eight are told
// apart by where the arrow goes: at a reticle, straight out, into a mouth, round a body, out through a gap, down onto
// a card, up through a ring, back round a circle.

import * as shape from '../svg-glyph';
import { LEVEL_GOLD, LIGHT_ACCENT, PANEL_RIM, TEXT_LABEL, WHITE } from './colours';
import {
  SUBJECT_ALPHA,
  SUBJECT_RAMP,
  SUBJECT_STROKE,
  arrowLayers,
  bodyGlint,
  rampedMarkLayers,
  roundBodyLayers,
} from './subject-glyph-motifs';
import { arcPath, arrowHeadPath, circlePath, crescentPath } from './subject-glyph-shapes';
import * as kit from './trait-glyph-layers';

/** The bead an action acts on and the head every gesture ends in. */
const ACTION = { beadRadius: 12, smallBeadRadius: 8, headLength: 15, ringRadius: 27 } as const;

/** The reticle a steer points at: a ring notched by four ticks, so the target is a shape, not a dot. */
const RETICLE_CENTRE = { cx: 62, cy: 40 } as const;
const RETICLE = shape.path(
  [
    circlePath(RETICLE_CENTRE.cx, RETICLE_CENTRE.cy, 10),
    shape.radialStrokesPath({
      ...RETICLE_CENTRE,
      count: 4,
      innerRadius: 8,
      outerRadius: 17,
      leanTurns: 0,
      phaseTurns: 0,
    }),
  ].join(' '),
);
const STEER: shape.SubjectGlyph = {
  entryId: 'action:steer',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.outlineLayer(RETICLE, SUBJECT_STROKE.fine, kit.BEAT),
    kit.paint(shape.GLYPH_ROLE.body, RETICLE, {
      stroke: kit.stroke(LIGHT_ACCENT, SUBJECT_STROKE.fine),
      motion: kit.BEAT,
    }),
    ...roundBodyLayers({
      cx: 35,
      cy: 65,
      radius: ACTION.beadRadius - 1,
      ramp: SUBJECT_RAMP.player,
      rim: kit.stroke(SUBJECT_RAMP.player.light, SUBJECT_STROKE.fine),
    }),
    ...arrowLayers(
      { fromX: 38, fromY: 58, toX: 58, toY: 44, bow: 10, headLength: ACTION.headLength },
      SUBJECT_RAMP.accent,
    ),
  ],
};

const SPEED_LINES = shape.path('M16 36 L34 36 M14 50 L30 50 M16 64 L34 64');
const SPRINT: shape.SubjectGlyph = {
  entryId: 'action:sprint',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.outlineLayer(SPEED_LINES, SUBJECT_STROKE.fine, kit.BEAT),
    kit.paint(shape.GLYPH_ROLE.body, SPEED_LINES, {
      stroke: kit.stroke(LIGHT_ACCENT, SUBJECT_STROKE.fine, SUBJECT_ALPHA.scatter),
      motion: kit.BEAT,
    }),
    ...roundBodyLayers({
      cx: 42,
      cy: 50,
      radius: ACTION.beadRadius,
      ramp: SUBJECT_RAMP.vent,
      rim: kit.stroke(SUBJECT_RAMP.vent.light, SUBJECT_STROKE.fine),
      motion: kit.BEAT,
    }),
    ...arrowLayers(
      { fromX: 54, fromY: 50, toX: 84, toY: 50, bow: 0, headLength: ACTION.headLength },
      SUBJECT_RAMP.vent,
      kit.BEAT,
    ),
  ],
};

/** A mouth open at the left and a mote arriving at it: eating is food crossing a rim. */
const MOUTH = shape.path(crescentPath({ cx: 38, cy: 50, radius: 22, thickness: 8, fromTurns: 0.14, toTurns: 0.86 }));
const EAT: shape.SubjectGlyph = {
  entryId: 'action:eat',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    ...rampedMarkLayers(MOUTH, kit.GLYPH_RAMP.vacuole, kit.BEAT),
    ...roundBodyLayers({
      cx: 74,
      cy: 50,
      radius: ACTION.smallBeadRadius,
      ramp: SUBJECT_RAMP.algae,
      rim: kit.stroke(SUBJECT_RAMP.algae.light, SUBJECT_STROKE.hair),
    }),
    ...arrowLayers(
      { fromX: 64, fromY: 50, toX: 40, toY: 50, bow: 0, headLength: ACTION.headLength },
      SUBJECT_RAMP.algae,
      kit.BEAT,
    ),
  ],
};

/** The arrow wraps the prey rather than pointing at it: engulf is a hold, not a hit. */
const WRAP = shape.path(crescentPath({ cx: 46, cy: 50, radius: 30, thickness: 9, fromTurns: 0.1, toTurns: 0.9 }));
const ENGULF: shape.SubjectGlyph = {
  entryId: 'action:engulf',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    ...rampedMarkLayers(WRAP, SUBJECT_RAMP.player, kit.BEAT),
    ...roundBodyLayers({
      cx: 54,
      cy: 50,
      radius: ACTION.smallBeadRadius,
      ramp: SUBJECT_RAMP.rod,
      rim: kit.stroke(WHITE, SUBJECT_STROKE.hair),
      motion: kit.BEAT,
    }),
    ...arrowLayers(
      { fromX: 72, fromY: 26, toX: 68, toY: 66, bow: 12, headLength: ACTION.headLength },
      SUBJECT_RAMP.player,
      kit.BEAT,
    ),
  ],
};

/** The same wrap, broken: the gap on the lit side and the arrow leaving through it are what escape means. */
const BROKEN_WRAP = shape.path(
  crescentPath({ cx: 46, cy: 52, radius: 29, thickness: 9, fromTurns: 0.16, toTurns: 0.74 }),
);
const ESCAPE: shape.SubjectGlyph = {
  entryId: 'action:escape',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    ...rampedMarkLayers(BROKEN_WRAP, SUBJECT_RAMP.danger, kit.BEAT),
    ...roundBodyLayers({
      cx: 46,
      cy: 52,
      radius: ACTION.smallBeadRadius,
      ramp: SUBJECT_RAMP.player,
      rim: kit.stroke(SUBJECT_RAMP.player.light, SUBJECT_STROKE.hair),
    }),
    ...arrowLayers(
      { fromX: 52, fromY: 46, toX: 76, toY: 26, bow: 0, headLength: ACTION.headLength },
      SUBJECT_RAMP.accent,
      kit.BEAT,
    ),
  ],
};

/** Three cards, the middle one lifted and lit under the arrow: a pick, not an offer. */
const CARDS = shape.path('M24 54 h14 v22 h-14 Z M62 54 h14 v22 h-14 Z');
const PICKED_CARD = shape.path('M40 46 h20 v34 h-20 Z');
const PICK_TRAIT: shape.SubjectGlyph = {
  entryId: 'action:pick_trait',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(shape.circle(50, 58, 30), LIGHT_ACCENT, SUBJECT_ALPHA.wash),
    kit.paint(shape.GLYPH_ROLE.detail, CARDS, {
      fill: kit.solid(PANEL_RIM, SUBJECT_ALPHA.scatter),
      stroke: kit.stroke(TEXT_LABEL, SUBJECT_STROKE.hair, SUBJECT_ALPHA.wash),
    }),
    kit.outlineLayer(PICKED_CARD, SUBJECT_STROKE.hair, kit.BREATHE),
    kit.paint(shape.GLYPH_ROLE.body, PICKED_CARD, {
      fill: { kind: 'ramp', ramp: SUBJECT_RAMP.accent, opacity: 1 },
      stroke: kit.stroke(LIGHT_ACCENT, SUBJECT_STROKE.fine),
      motion: kit.BREATHE,
    }),
    ...arrowLayers(
      { fromX: 50, fromY: 14, toX: 50, toY: 38, bow: 0, headLength: ACTION.headLength },
      SUBJECT_RAMP.accent,
      kit.BREATHE,
    ),
  ],
};

/** The level ring with the arrow going up through it: the rung crossed, not the number reached. */
const LEVEL_RING = shape.path(arcPath({ cx: 50, cy: 58, radius: ACTION.ringRadius, fromTurns: 0.58, toTurns: 1.42 }));
const LEVEL_UP: shape.SubjectGlyph = {
  entryId: 'action:level_up',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(shape.circle(50, 56, 30), LEVEL_GOLD, SUBJECT_ALPHA.halo),
    kit.outlineLayer(LEVEL_RING, SUBJECT_STROKE.heavy, kit.BEAT),
    kit.paint(shape.GLYPH_ROLE.body, LEVEL_RING, {
      stroke: kit.stroke(LEVEL_GOLD, SUBJECT_STROKE.heavy),
      motion: kit.BEAT,
    }),
    ...arrowLayers(
      { fromX: 50, fromY: 82, toX: 50, toY: 22, bow: 0, headLength: ACTION.headLength + 3 },
      SUBJECT_RAMP.gold,
      kit.BEAT,
    ),
  ],
};

/** A full turn back to a fresh cell: the only gesture whose arrow closes on itself. */
const RESPAWN_ARC = shape.path(arcPath({ cx: 50, cy: 50, radius: ACTION.ringRadius, fromTurns: 0.8, toTurns: 1.68 }));
const RESPAWN_HEAD = shape.path(
  arrowHeadPath({ fromX: 30, fromY: 34, toX: 44, toY: 19, bow: 0, headLength: ACTION.headLength }),
);
const RESPAWN: shape.SubjectGlyph = {
  entryId: 'action:respawn',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(kit.centreCircle(32), LIGHT_ACCENT, SUBJECT_ALPHA.wash),
    kit.outlineLayer(RESPAWN_ARC, SUBJECT_STROKE.heavy, kit.SPIN),
    kit.paint(shape.GLYPH_ROLE.body, RESPAWN_ARC, {
      stroke: kit.stroke(LIGHT_ACCENT, SUBJECT_STROKE.heavy),
      motion: kit.SPIN,
    }),
    kit.outlineLayer(RESPAWN_HEAD, SUBJECT_STROKE.hair, kit.SPIN),
    /** Solid, not ramped: the head turns with the ring, and a ramp that turns would turn the light with it. */
    kit.paint(shape.GLYPH_ROLE.signature, RESPAWN_HEAD, {
      fill: kit.solid(SUBJECT_RAMP.accent.base),
      stroke: kit.stroke(SUBJECT_RAMP.accent.light, SUBJECT_STROKE.hair),
      motion: kit.SPIN,
    }),
    ...roundBodyLayers({
      cx: 50,
      cy: 50,
      radius: ACTION.beadRadius,
      ramp: SUBJECT_RAMP.player,
      rim: kit.stroke(SUBJECT_RAMP.player.light, SUBJECT_STROKE.fine),
      motion: kit.BREATHE,
    }),
    bodyGlint(50, 50, ACTION.beadRadius, kit.BREATHE),
  ],
};

export const ACTION_SUBJECT_GLYPHS: readonly shape.SubjectGlyph[] = [
  STEER,
  SPRINT,
  EAT,
  ENGULF,
  ESCAPE,
  PICK_TRAIT,
  LEVEL_UP,
  RESPAWN,
];
