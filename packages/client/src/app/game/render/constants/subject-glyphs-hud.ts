// The seven HUD topics (docs/visual-style/ui-type.md §7.2): each element drawn as the screen shows it. The five
// indicators sit on the player's own cell (the first seat's body, since that cell is what they are drawn on); the
// leaderboard and the round clock sit on the HUD's own panel. Angles are turns clockwise from 3 o'clock, so the
// DNA ring and the ladder orbit start at `TWELVE_O_CLOCK` as they do in play.

import * as shape from '../svg-glyph';
import {
  DANGER,
  DNA,
  LEVEL_RING_TRACK,
  LIGHT_ACCENT,
  MITO_BASE,
  NUCLEOID_STRAND,
  PANEL_BOTTOM,
  PANEL_RIM,
  PANEL_TOP,
  TEXT_LABEL,
  TEXT_MUTED,
  WHITE,
} from './colours';
import {
  GLYPH_PLAYER_SEAT,
  SUBJECT_ALPHA,
  SUBJECT_RAMP,
  SUBJECT_STROKE,
  bodyGlint,
  roundBodyLayers,
  strokedMarkLayers,
} from './subject-glyph-motifs';
import { ownCellLayers } from './subject-glyph-own-cell';
import { arcPath } from './subject-glyph-shapes';
import * as kit from './trait-glyph-layers';

/** Where the HUD draws from: the top of a ring. */
const TWELVE_O_CLOCK = -0.25;
/** The own cell and the rings around it. */
const OWN = { bodyRadius: 27, dnaRingRadius: 15, selfRingRadius: 31, selfBodyRadius: 20 } as const;
/** The HUD panel the two DOM elements sit on, lit like the game's own panels. */
const PANEL_RAMP: shape.GlyphRamp = { light: PANEL_RIM, base: PANEL_TOP, dark: PANEL_BOTTOM };
/** The identity ring's dash, the one dashed circle on the screen. */
const SELF_RING_DASH = '6 4';

/** The DNA ring: the dark track inside the cell and the DNA arc filling it clockwise from the top. */
const DNA_ARC = shape.path(
  arcPath({ cx: 50, cy: 50, radius: OWN.dnaRingRadius, fromTurns: TWELVE_O_CLOCK, toTurns: 0.4 }),
);
const DNA_RING: shape.SubjectGlyph = {
  entryId: 'hud:dna_ring',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    ...ownCellLayers(50, 50, OWN.bodyRadius, kit.BREATHE),
    kit.paint(shape.GLYPH_ROLE.signature, kit.centreCircle(OWN.dnaRingRadius), {
      stroke: kit.stroke(LEVEL_RING_TRACK, SUBJECT_STROKE.heavy),
    }),
    kit.paint(shape.GLYPH_ROLE.signature, DNA_ARC, {
      stroke: kit.stroke(DNA, SUBJECT_STROKE.heavy),
      motion: kit.BREATHE,
    }),
  ],
};

/** The level numeral: a bold `WHITE` figure on its dark outline at the ring's centre, as the HUD draws it at rest. */
const NUMERAL = shape.path('M42 41 C43 34 57 34 57 42 C57 48 44 52 42 60 L58 60');
const LEVEL_NUMERAL: shape.SubjectGlyph = {
  entryId: 'hud:level_numeral',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    ...ownCellLayers(50, 50, OWN.bodyRadius, kit.BREATHE),
    kit.paint(shape.GLYPH_ROLE.detail, kit.centreCircle(OWN.dnaRingRadius + SUBJECT_STROKE.heavy), {
      stroke: kit.stroke(LEVEL_RING_TRACK, SUBJECT_STROKE.fine, SUBJECT_ALPHA.scatter),
    }),
    ...strokedMarkLayers(NUMERAL, WHITE, SUBJECT_STROKE.mark, kit.BEAT),
  ],
};

/** The ladder orbit: a backing arc over the cell, the dashed ghost of the next rung and a row of lit pips. */
const ORBIT = { cx: 50, cy: 56, radius: 27, bodyRadius: 15 } as const;
const ORBIT_CENTRE: shape.Point = [ORBIT.cx, ORBIT.cy];
const ORBIT_BAND = shape.path(arcPath({ ...ORBIT, fromTurns: 0.55, toTurns: 0.95 }));
const ORBIT_GHOST = shape.circle(...shape.polar(ORBIT_CENTRE, ORBIT.radius, 0.62), 7);
const PIP_TURNS = [0.74, 0.8, 0.86] as const;
const UNLIT_PIP_TURNS = [0.92] as const;
const pipsAt = (turns: readonly number[]): shape.GlyphShape =>
  shape.path(
    shape.dotsPath(
      turns.map((turn) => shape.polar(ORBIT_CENTRE, ORBIT.radius, turn)),
      2.6,
    ),
  );
const LADDER_ORBIT: shape.SubjectGlyph = {
  entryId: 'hud:ladder_orbit',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    ...ownCellLayers(ORBIT.cx, ORBIT.cy, ORBIT.bodyRadius, kit.BREATHE),
    kit.paint(shape.GLYPH_ROLE.signature, ORBIT_BAND, {
      stroke: kit.stroke(LEVEL_RING_TRACK, SUBJECT_STROKE.heavy + SUBJECT_STROKE.fine),
    }),
    kit.paint(shape.GLYPH_ROLE.signature, ORBIT_GHOST, {
      stroke: kit.stroke(NUCLEOID_STRAND, SUBJECT_STROKE.rim, 1, '3 2'),
      motion: kit.BREATHE,
    }),
    kit.paint(shape.GLYPH_ROLE.signature, pipsAt(PIP_TURNS), { fill: kit.solid(MITO_BASE), motion: kit.BEAT }),
    kit.paint(shape.GLYPH_ROLE.detail, pipsAt(UNLIT_PIP_TURNS), {
      stroke: kit.stroke(MITO_BASE, SUBJECT_STROKE.hair, SUBJECT_ALPHA.scatter),
    }),
  ],
};

/** The self ring: the dashed identity ring, recharged most of the way round, over the faint rest of its track. */
const SELF_RING_CHARGED = shape.path(
  arcPath({ cx: 50, cy: 50, radius: OWN.selfRingRadius, fromTurns: TWELVE_O_CLOCK, toTurns: 0.45 }),
);
const SELF_RING: shape.SubjectGlyph = {
  entryId: 'hud:self_ring',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    ...ownCellLayers(50, 50, OWN.selfBodyRadius, kit.BREATHE),
    kit.paint(shape.GLYPH_ROLE.signature, kit.centreCircle(OWN.selfRingRadius), {
      stroke: kit.stroke(WHITE, SUBJECT_STROKE.mark, SUBJECT_ALPHA.faint, SELF_RING_DASH),
    }),
    kit.paint(shape.GLYPH_ROLE.signature, SELF_RING_CHARGED, {
      stroke: kit.stroke(WHITE, SUBJECT_STROKE.mark, 1, SELF_RING_DASH),
      motion: kit.BREATHE,
    }),
  ],
};

/** The threat ring: the red warning ring round a bigger cell, and the own cell it can swallow beside it. */
const THREAT = { cx: 58, cy: 42, radius: 17, ringRadius: 23 } as const;
const THREAT_RING: shape.SubjectGlyph = {
  entryId: 'hud:threat_ring',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    ...roundBodyLayers({
      cx: THREAT.cx,
      cy: THREAT.cy,
      radius: THREAT.radius,
      ramp: SUBJECT_RAMP.wild,
      rim: kit.stroke(SUBJECT_RAMP.wild.light, SUBJECT_STROKE.rim, SUBJECT_ALPHA.scatter),
    }),
    ...ownCellLayers(32, 66, 9, kit.BREATHE),
    kit.paint(shape.GLYPH_ROLE.signature, shape.circle(THREAT.cx, THREAT.cy, THREAT.ringRadius), {
      stroke: kit.stroke(DANGER, SUBJECT_STROKE.mark),
      motion: kit.motion(shape.GLYPH_MOTION.beat, THREAT.cx, THREAT.cy),
    }),
  ],
};

/** A HUD panel: the plate both DOM elements are printed on. */
function panelLayers(panel: shape.GlyphShape): readonly shape.GlyphLayer[] {
  return [
    kit.haloLayer(kit.centreCircle(34), LIGHT_ACCENT, SUBJECT_ALPHA.faint),
    ...kit.shadedBody({ shape: panel, ramp: PANEL_RAMP, rim: kit.stroke(PANEL_RIM, SUBJECT_STROKE.rim) }),
  ];
}

/** The leaderboard: three ranked rows of falling length, the own row lit, each led by its swatch. */
const BOARD = shape.path('M26 28 h48 v44 h-48 Z');
const BOARD_ROWS = shape.path('M37 38 L68 38 M37 62 L58 62');
const OWN_ROW = shape.path('M37 50 L64 50');
const LEADERBOARD: shape.SubjectGlyph = {
  entryId: 'hud:leaderboard',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    ...panelLayers(BOARD),
    kit.paint(shape.GLYPH_ROLE.signature, shape.path('M29 44 h42 v12 h-42 Z'), {
      fill: kit.solid(LIGHT_ACCENT, SUBJECT_ALPHA.wash),
      motion: kit.BREATHE,
    }),
    kit.paint(shape.GLYPH_ROLE.signature, BOARD_ROWS, { stroke: kit.stroke(TEXT_LABEL, SUBJECT_STROKE.mark) }),
    kit.paint(shape.GLYPH_ROLE.signature, OWN_ROW, { stroke: kit.stroke(WHITE, SUBJECT_STROKE.mark) }),
    /** The material detail: the hairline rules between the rows, dropped at the list LOD. */
    kit.paint(shape.GLYPH_ROLE.detail, shape.path('M29 44 L71 44 M29 56 L71 56'), {
      stroke: kit.stroke(PANEL_RIM, SUBJECT_STROKE.hair),
    }),
    kit.paint(
      shape.GLYPH_ROLE.signature,
      shape.path(
        shape.dotsPath(
          [
            [31, 38],
            [31, 62],
          ],
          3,
        ),
      ),
      { fill: kit.solid(TEXT_MUTED) },
    ),
    kit.paint(shape.GLYPH_ROLE.signature, shape.circle(31, 50, 3), { fill: kit.solid(GLYPH_PLAYER_SEAT.base) }),
    bodyGlint(34, 32, 8),
  ],
};

/** The round clock: an `m:ss` readout in segment strokes, its colon ticking, the caption under the plate. */
const CLOCK_PLATE = shape.path('M24 36 h52 v28 h-52 Z');
const CLOCK_DIGITS = shape.path('M30 42 h8 v16 h-8 M30 50 h8 M48 42 h8 v16 h-8 Z M61 42 h8 v16');
const CLOCK_COLON = shape.path(
  shape.dotsPath(
    [
      [43, 46],
      [43, 54],
    ],
    1.8,
  ),
);
const ROUND_CLOCK: shape.SubjectGlyph = {
  entryId: 'hud:round_clock',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    ...panelLayers(CLOCK_PLATE),
    ...strokedMarkLayers(CLOCK_DIGITS, WHITE, SUBJECT_STROKE.rim),
    kit.paint(shape.GLYPH_ROLE.signature, CLOCK_COLON, { fill: kit.solid(WHITE), motion: kit.BEAT }),
    /** The material detail: the `ROUND` caption under the plate, which a 20 px mark has no room to show. */
    kit.paint(shape.GLYPH_ROLE.detail, shape.path('M38 71 L62 71'), {
      stroke: kit.stroke(TEXT_LABEL, SUBJECT_STROKE.fine),
    }),
    bodyGlint(34, 42, 8),
  ],
};

export const HUD_SUBJECT_GLYPHS: readonly shape.SubjectGlyph[] = [
  DNA_RING,
  LEVEL_NUMERAL,
  LADDER_ORBIT,
  SELF_RING,
  THREAT_RING,
  LEADERBOARD,
  ROUND_CLOCK,
];
