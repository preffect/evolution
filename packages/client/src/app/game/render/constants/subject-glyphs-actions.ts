// The eight actions (docs/visual-style/ui-type.md §7.2). An action is something the player does, so every action
// glyph is a **gesture**: a bold arrow in the accent, or in the colour of what the verb acts on, with the thing it
// acts on drawn small beside it. The arrowhead is the family mark — no ability glyph has one — and the eight are told
// apart by where the arrow goes: at a reticle, straight out, into a mouth, round a body, out through a gap, down onto
// a card, up through a ring, back round a circle.

import * as shape from '../svg-glyph';
import { LEVEL_GOLD, LIGHT_ACCENT, TEXT_LABEL, WHITE } from './colours';
import {
  SUBJECT_ALPHA,
  SUBJECT_RAMP,
  SUBJECT_STROKE,
  arrowLayers,
  strokedMarkLayers,
  bodyGlint,
  rampedMarkLayers,
  roundBodyLayers,
} from './subject-glyph-motifs';
import { arcPath, arrowHeadPath, circlePath, crescentPath } from './subject-glyph-shapes';
import * as kit from './trait-glyph-layers';

/** The bead an action acts on and the head every gesture ends in. */
const ACTION = { beadRadius: 12, smallBeadRadius: 8, headLength: 15, ringRadius: 27 } as const;

/**
 * A steer points the cell at a place. The reticle is drawn heavy — a filled ring with four thick ticks — because at
 * 20 px a hairline crosshair is nothing at all; the arrowhead that marks this as an action is ~2 px there, so the
 * mass has to carry it.
 */
const RETICLE_CENTRE = { cx: 63, cy: 39 } as const;
const RETICLE_RING = shape.path(circlePath(RETICLE_CENTRE.cx, RETICLE_CENTRE.cy, 11));
const RETICLE_TICKS = shape.path(
  shape.radialStrokesPath({ ...RETICLE_CENTRE, count: 4, innerRadius: 11, outerRadius: 18, leanTurns: 0, phaseTurns: 0 }),
);
const STEER: shape.SubjectGlyph = {
  entryId: 'action:steer',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(shape.circle(RETICLE_CENTRE.cx, RETICLE_CENTRE.cy, 26), LIGHT_ACCENT, SUBJECT_ALPHA.halo),
    ...strokedMarkLayers(RETICLE_TICKS, LIGHT_ACCENT, SUBJECT_STROKE.heavy, kit.BEAT),
    kit.outlineLayer(RETICLE_RING, SUBJECT_STROKE.mark, kit.BEAT),
    kit.paint(shape.GLYPH_ROLE.body, RETICLE_RING, {
      stroke: kit.stroke(LIGHT_ACCENT, SUBJECT_STROKE.heavy),
      motion: kit.BEAT,
    }),
    ...roundBodyLayers({
      cx: 35,
      cy: 65,
      radius: ACTION.beadRadius - 1,
      ramp: SUBJECT_RAMP.player,
      rim: kit.stroke(SUBJECT_RAMP.player.light, SUBJECT_STROKE.rim),
    }),
    ...arrowLayers({ fromX: 42, fromY: 58, toX: 54, toY: 50, bow: 5, headLength: ACTION.headLength }, SUBJECT_RAMP.accent),
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

/**
 * Three offers with the middle one taken. Drawn as medallions rather than cards: at 20 px the card stack and its
 * arrow both dissolved and the glyph read as a bottle. Three discs with the chosen one larger, lit and ringed
 * survives, and the accent is right where gold would be borrowed — picking a trait is not levelling.
 */
const PICK_OFFERED: readonly (readonly [number, number])[] = [
  [27, 56],
  [73, 56],
];
const PICK_CHOSEN = { cx: 50, cy: 56, radius: 14 } as const;
const PICK_TRAIT: shape.SubjectGlyph = {
  entryId: 'action:pick_trait',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(shape.circle(PICK_CHOSEN.cx, PICK_CHOSEN.cy, 28), LIGHT_ACCENT, SUBJECT_ALPHA.halo),
    ...PICK_OFFERED.flatMap(([centreX, centreY]) => [
      kit.outlineLayer(shape.circle(centreX, centreY, 11), SUBJECT_STROKE.hair),
      // Bright enough to count: at 20 px a panel-rim disc is the background, and the glyph read as one lit bulb.
      kit.paint(shape.GLYPH_ROLE.detail, shape.circle(centreX, centreY, 11), {
        fill: kit.solid(TEXT_LABEL, SUBJECT_ALPHA.wash),
        stroke: kit.stroke(TEXT_LABEL, SUBJECT_STROKE.fine),
      }),
    ]),
    ...roundBodyLayers({
      cx: PICK_CHOSEN.cx,
      cy: PICK_CHOSEN.cy,
      radius: PICK_CHOSEN.radius,
      ramp: SUBJECT_RAMP.accent,
      rim: kit.stroke(LIGHT_ACCENT, SUBJECT_STROKE.rim),
      motion: kit.BREATHE,
    }),
    kit.paint(shape.GLYPH_ROLE.signature, shape.circle(PICK_CHOSEN.cx, PICK_CHOSEN.cy, PICK_CHOSEN.radius + 4), {
      stroke: kit.stroke(LIGHT_ACCENT, SUBJECT_STROKE.mark),
      motion: kit.BREATHE,
    }),
    ...arrowLayers({ fromX: 50, fromY: 18, toX: 50, toY: 34, bow: 0, headLength: ACTION.headLength - 3 }, SUBJECT_RAMP.accent, kit.BREATHE),
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
