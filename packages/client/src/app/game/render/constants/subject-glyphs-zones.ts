// The four zones, drawn as the dish draws them (docs/visual-style/ui-type.md §7.2): a lit shallows band under the
// glass wall, the vent's broken crust and its molten seam, the gel's bent strands, and the open broth's drifting motes
// under the condenser. Each is one silhouette, not a scene — a zone page has to read at 20 px beside its name.

import * as shape from '../svg-glyph';
import {
  DEPTH_NEAR,
  LIGHT_ACCENT,
  VENT_PLUME,
  VENT_SEAM_HOT,
  WALL_GLASS_OUTER,
  WHITE,
  ZONE_GEL,
  ZONE_SHALLOWS,
  ZONE_VENT,
} from './colours';
import {
  SUBJECT_ALPHA,
  SUBJECT_RAMP,
  SUBJECT_STROKE,
  bodyGlint,
  driftingMotesLayer,
  roundBodyLayers,
  washLayer,
} from './subject-glyph-motifs';
import { arcPath, crescentPath, strandPath } from './subject-glyph-shapes';
import * as kit from './trait-glyph-layers';

/** Where a zone's band and the dish's wall sit inside the medallion, and how far a zone's tint washes. */
const ZONE = { bandRadius: 29, bandThickness: 10, wallRadius: 35, washRadius: 34 } as const;

/** A band, outlined and lit: the shape a zone takes when it is the subject rather than the ground. */
function bandLayers(
  drawing: shape.GlyphShape,
  ramp: shape.GlyphRamp,
  motion?: shape.GlyphMotion,
): readonly shape.GlyphLayer[] {
  return [
    kit.poolLayer(drawing, motion),
    kit.outlineLayer(drawing, SUBJECT_STROKE.hair, motion),
    kit.paint(shape.GLYPH_ROLE.body, drawing, {
      fill: { kind: 'ramp', ramp, opacity: 1 },
      stroke: kit.stroke(ramp.light, SUBJECT_STROKE.hair, SUBJECT_ALPHA.scatter),
      ...(motion === undefined ? {} : { motion }),
    }),
  ];
}

/** The shallows: a green band hugging the glass, with the caustics the condenser throws across it. */
const SHALLOWS_BAND = shape.path(
  crescentPath({
    cx: 50,
    cy: 50,
    radius: ZONE.bandRadius,
    thickness: ZONE.bandThickness,
    fromTurns: 0.55,
    toTurns: 1.45,
  }),
);
const CAUSTICS = shape.path('M24 26 C34 34 34 44 26 52 M38 16 C48 26 48 38 40 48');
const SUNLIT_SHALLOWS: shape.SubjectGlyph = {
  entryId: 'zone:sunlit_shallows',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    washLayer(ZONE.washRadius, ZONE_SHALLOWS),
    ...bandLayers(SHALLOWS_BAND, SUBJECT_RAMP.shallows, kit.BREATHE),
    kit.paint(
      shape.GLYPH_ROLE.signature,
      shape.path(arcPath({ cx: 50, cy: 50, radius: ZONE.wallRadius, fromTurns: 0.5, toTurns: 1.5 })),
      {
        stroke: kit.stroke(WALL_GLASS_OUTER, SUBJECT_STROKE.heavy),
      },
    ),
    kit.paint(
      shape.GLYPH_ROLE.signature,
      shape.path(arcPath({ cx: 50, cy: 50, radius: ZONE.wallRadius - 4, fromTurns: 0.58, toTurns: 1.42 })),
      {
        stroke: kit.stroke(WHITE, SUBJECT_STROKE.hair, SUBJECT_ALPHA.scatter),
      },
    ),
    kit.paint(shape.GLYPH_ROLE.detail, CAUSTICS, {
      stroke: kit.stroke(LIGHT_ACCENT, SUBJECT_STROKE.hair, SUBJECT_ALPHA.wash),
      motion: kit.motion(shape.GLYPH_MOTION.sway, 30, 30),
    }),
    bodyGlint(34, 30, 12),
  ],
};

/** The vent: two plates of basalt broken apart, the seam between them still molten, cracks glowing across the rock. */
const PLATES = shape.path(
  'M26 32 L38 36 L50 31 L62 36 L74 33 L74 44 L64 49 L50 45 L36 50 L26 46 Z ' +
    'M26 72 L36 68 L50 72 L62 68 L72 71 L70 62 L60 58 L48 63 L36 58 L26 63 Z',
);
const CRACKS = shape.path('M33 36 L37 41 L33 45 M56 35 L60 41 L56 46 M40 69 L44 65 L40 61 M64 69 L66 65 L62 61');
const SEAM = shape.path(strandPath({ fromX: 24, toX: 76, y: 54, amplitude: 4, waves: 1.5, phaseTurns: 0 }));
const WARM_VENT: shape.SubjectGlyph = {
  entryId: 'zone:warm_vent',
  tiltDeg: -12,
  layers: [
    washLayer(ZONE.washRadius, ZONE_VENT),
    ...bandLayers(PLATES, SUBJECT_RAMP.crust),
    kit.paint(shape.GLYPH_ROLE.halo, SEAM, {
      stroke: kit.stroke(ZONE_VENT, SUBJECT_STROKE.heavy * 2.5, SUBJECT_ALPHA.halo),
    }),
    kit.paint(shape.GLYPH_ROLE.signature, SEAM, {
      stroke: kit.stroke(ZONE_VENT, SUBJECT_STROKE.heavy + SUBJECT_STROKE.mark),
    }),
    kit.paint(shape.GLYPH_ROLE.signature, SEAM, { stroke: kit.stroke(VENT_SEAM_HOT, SUBJECT_STROKE.heavy) }),
    kit.paint(shape.GLYPH_ROLE.signature, SEAM, { stroke: kit.stroke(WHITE, SUBJECT_STROKE.fine) }),
    kit.paint(shape.GLYPH_ROLE.detail, CRACKS, {
      stroke: kit.stroke(VENT_PLUME, SUBJECT_STROKE.hair, SUBJECT_ALPHA.scatter),
      motion: kit.BEAT,
    }),
    bodyGlint(44, 40, 11),
  ],
};

/** The gel: a violet patch thick with bent strands, the only zone that reads as a texture rather than an edge. */
const GEL_STRANDS = shape.path(
  [
    strandPath({ fromX: 26, toX: 74, y: 36, amplitude: 6, waves: 1, phaseTurns: 0 }),
    strandPath({ fromX: 24, toX: 76, y: 50, amplitude: 8, waves: 1, phaseTurns: 0.5 }),
    strandPath({ fromX: 26, toX: 74, y: 64, amplitude: 6, waves: 1, phaseTurns: 0.25 }),
  ].join(' '),
);
const VISCOUS_GEL: shape.SubjectGlyph = {
  entryId: 'zone:viscous_gel',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    ...roundBodyLayers({
      cx: 50,
      cy: 50,
      radius: 32,
      ramp: SUBJECT_RAMP.gel,
      rim: kit.stroke(ZONE_GEL, SUBJECT_STROKE.fine, SUBJECT_ALPHA.scatter),
      motion: kit.BREATHE,
      opacity: 0.5,
    }),
    kit.outlineLayer(GEL_STRANDS, SUBJECT_STROKE.mark, kit.motion(shape.GLYPH_MOTION.sway)),
    kit.paint(shape.GLYPH_ROLE.signature, GEL_STRANDS, {
      stroke: kit.stroke(ZONE_GEL, SUBJECT_STROKE.mark),
      motion: kit.motion(shape.GLYPH_MOTION.sway),
    }),
  ],
};

/** The open broth: no tint and no feature, only the condenser pool and the depth motes drifting through it. */
const OPEN_BROTH: shape.SubjectGlyph = {
  entryId: 'zone:open_broth',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(shape.circle(42, 42, 32), LIGHT_ACCENT, SUBJECT_ALPHA.wash),
    ...roundBodyLayers({
      cx: 47,
      cy: 47,
      radius: 31,
      ramp: SUBJECT_RAMP.broth,
      rim: kit.stroke(LIGHT_ACCENT, SUBJECT_STROKE.fine, SUBJECT_ALPHA.scatter),
      opacity: 0.85,
    }),
    driftingMotesLayer(
      [
        [30, 32],
        [58, 26],
        [70, 50],
        [36, 62],
        [62, 70],
        [46, 46],
      ],
      3,
      DEPTH_NEAR,
      shape.GLYPH_ROLE.signature,
    ),
    driftingMotesLayer(
      [
        [24, 52],
        [52, 60],
        [74, 34],
        [40, 22],
        [66, 58],
      ],
      1.6,
      WHITE,
      shape.GLYPH_ROLE.detail,
    ),
  ],
};

export const ZONE_SUBJECT_GLYPHS: readonly shape.SubjectGlyph[] = [SUNLIT_SHALLOWS, WARM_VENT, VISCOUS_GEL, OPEN_BROTH];
