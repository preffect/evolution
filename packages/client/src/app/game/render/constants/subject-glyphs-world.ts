// The four world topics (docs/visual-style/ui-type.md §7.2), drawn as the world's own instruments rather than as
// places: the dish seen whole behind its glass, the world clock's ticked dial, a bloom bursting, and the round running
// down in its glass. They share the zone tables' band and body motifs (`subject-glyphs-zones.ts`).

import * as shape from '../svg-glyph';
import { DEPTH_NEAR, LEVEL_GOLD, LIGHT_ACCENT, WALL_GLASS_OUTER, WHITE, ZONE_SHALLOWS } from './colours';
import {
  SUBJECT_ALPHA,
  SUBJECT_RAMP,
  SUBJECT_STROKE,
  bodyGlint,
  driftingMotesLayer,
  roundBodyLayers,
} from './subject-glyph-motifs';
import { arcPath } from './subject-glyph-shapes';
import * as kit from './trait-glyph-layers';

/** Where the dish's glass and the clock's dial sit inside the medallion. */
const TOPIC = { wallRadius: 35, dialRadius: 28 } as const;

/** The dish seen whole: the glass wall's three rings, the shallows inside them, the broth in the middle. */
const DISH: shape.SubjectGlyph = {
  entryId: 'world:dish',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    ...roundBodyLayers({
      cx: 50,
      cy: 50,
      radius: TOPIC.wallRadius - 6,
      ramp: SUBJECT_RAMP.broth,
      rim: kit.stroke(SUBJECT_RAMP.glass.light, SUBJECT_STROKE.hair, SUBJECT_ALPHA.wash),
      motion: kit.BREATHE,
    }),
    /** The one hard edge in the world: the glass, a thick ring with a bright hairline standing off its outer face. */
    kit.paint(shape.GLYPH_ROLE.signature, kit.centreCircle(TOPIC.wallRadius - 9), {
      stroke: kit.stroke(ZONE_SHALLOWS, SUBJECT_STROKE.heavy, SUBJECT_ALPHA.scatter),
    }),
    kit.paint(shape.GLYPH_ROLE.signature, kit.centreCircle(TOPIC.wallRadius - 3), {
      stroke: kit.stroke(SUBJECT_RAMP.glass.base, SUBJECT_STROKE.heavy + SUBJECT_STROKE.fine),
    }),
    kit.paint(shape.GLYPH_ROLE.signature, kit.centreCircle(TOPIC.wallRadius), {
      stroke: kit.stroke(WALL_GLASS_OUTER, SUBJECT_STROKE.rim),
    }),
    kit.paint(
      shape.GLYPH_ROLE.signature,
      shape.path(arcPath({ cx: 50, cy: 50, radius: TOPIC.wallRadius, fromTurns: 0.55, toTurns: 0.73 })),
      {
        stroke: kit.stroke(WHITE, SUBJECT_STROKE.fine),
      },
    ),
    driftingMotesLayer(
      [
        [40, 44],
        [60, 56],
        [52, 36],
      ],
      3,
      DEPTH_NEAR,
      shape.GLYPH_ROLE.detail,
    ),
  ],
};

/** The world clock: a ticked dial with one hand, and the rising bar the world's average cell is. */
const DIAL_TICKS = shape.path(
  shape.radialStrokesPath({
    ...kit.GLYPH_CENTRE_POINT,
    count: 12,
    innerRadius: TOPIC.dialRadius - 5,
    outerRadius: TOPIC.dialRadius,
    leanTurns: 0,
    phaseTurns: 0,
  }),
);
const CLOCK_HAND = shape.path('M50 50 L50 26');
const WORLD_CLOCK: shape.SubjectGlyph = {
  entryId: 'world:world_clock',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    ...roundBodyLayers({
      cx: 50,
      cy: 50,
      radius: TOPIC.dialRadius,
      ramp: SUBJECT_RAMP.accent,
      rim: kit.stroke(LIGHT_ACCENT, SUBJECT_STROKE.rim),
      opacity: 0.45,
    }),
    kit.paint(shape.GLYPH_ROLE.detail, DIAL_TICKS, {
      stroke: kit.stroke(LIGHT_ACCENT, SUBJECT_STROKE.fine, SUBJECT_ALPHA.scatter),
    }),
    kit.outlineLayer(CLOCK_HAND, SUBJECT_STROKE.heavy, kit.SPIN),
    kit.paint(shape.GLYPH_ROLE.signature, CLOCK_HAND, {
      stroke: kit.stroke(WHITE, SUBJECT_STROKE.heavy),
      motion: kit.SPIN,
    }),
    kit.paint(shape.GLYPH_ROLE.signature, kit.centreCircle(5), { fill: kit.solid(LIGHT_ACCENT) }),
    bodyGlint(50, 50, TOPIC.dialRadius),
  ],
};

/** A bloom: one bright core throwing motes out along its rays, which is what a bloom looks like from above. */
const BLOOM_RAYS = shape.path(
  shape.radialStrokesPath({
    ...kit.GLYPH_CENTRE_POINT,
    count: 8,
    innerRadius: 14,
    outerRadius: 30,
    leanTurns: 0.02,
    phaseTurns: 0.06,
  }),
);
const BLOOM: shape.SubjectGlyph = {
  entryId: 'world:bloom',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(kit.centreCircle(34), SUBJECT_RAMP.algae.base, SUBJECT_ALPHA.halo),
    kit.outlineLayer(BLOOM_RAYS, SUBJECT_STROKE.fine, kit.BEAT),
    kit.paint(shape.GLYPH_ROLE.signature, BLOOM_RAYS, {
      stroke: kit.stroke(SUBJECT_RAMP.algae.light, SUBJECT_STROKE.fine),
      motion: kit.BEAT,
    }),
    kit.paint(
      shape.GLYPH_ROLE.signature,
      shape.path(
        shape.dotRingPath({ ...kit.GLYPH_CENTRE_POINT, count: 8, ringRadius: 32, dotRadius: 4, phaseTurns: 0.06 }),
      ),
      { fill: kit.solid(SUBJECT_RAMP.algae.base), motion: kit.BEAT },
    ),
    ...roundBodyLayers({
      cx: 50,
      cy: 50,
      radius: 13,
      ramp: SUBJECT_RAMP.algae,
      rim: kit.stroke(SUBJECT_RAMP.algae.light, SUBJECT_STROKE.rim),
      motion: kit.BEAT,
    }),
  ],
};

/** The round: a glass running down, the one topic whose mark is an instrument rather than a place. */
const GLASS = shape.path('M32 24 h36 L54 50 L68 74 h-36 L46 50 Z');
const SAND = shape.path('M37 29 h26 L52 46 Z');
const ROUND: shape.SubjectGlyph = {
  entryId: 'world:round',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(kit.centreCircle(32), LEVEL_GOLD, SUBJECT_ALPHA.halo),
    kit.poolLayer(GLASS),
    kit.outlineLayer(GLASS, SUBJECT_STROKE.fine),
    kit.paint(shape.GLYPH_ROLE.body, GLASS, {
      fill: { kind: 'ramp', ramp: SUBJECT_RAMP.accent, opacity: 0.55 },
      stroke: kit.stroke(LIGHT_ACCENT, SUBJECT_STROKE.rim),
    }),
    kit.paint(shape.GLYPH_ROLE.signature, SAND, { fill: kit.solid(LEVEL_GOLD), motion: kit.BREATHE }),
    kit.paint(shape.GLYPH_ROLE.signature, shape.path('M50 52 L50 66'), {
      stroke: kit.stroke(LEVEL_GOLD, SUBJECT_STROKE.mark),
      motion: kit.BEAT,
    }),
    kit.paint(shape.GLYPH_ROLE.detail, shape.path('M40 70 h22 L52 60 Z'), {
      fill: kit.solid(LEVEL_GOLD, SUBJECT_ALPHA.scatter),
    }),
    bodyGlint(42, 30, 12),
  ],
};

export const WORLD_SUBJECT_GLYPHS: readonly shape.SubjectGlyph[] = [DISH, WORLD_CLOCK, BLOOM, ROUND];
