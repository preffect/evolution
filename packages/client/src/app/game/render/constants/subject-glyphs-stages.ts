// The five rungs of the ladder (docs/visual-style/ui-type.md §7.2), drawn as one cell growing more complex: a bare
// protocell film, a prokaryote's loose nucleoid, an endosymbiosis swallowing a rod, a eukaryote's ringed nucleus, and
// a specialised cell carrying three organelles behind a spined wall. Each rung changes the outline as well as the
// interior — the swallowed rod breaks the rim, the specialised wall bristles — so the ladder reads in order at 20 px.

import * as shape from '../svg-glyph';
import {
  CELL_WALL_LIGHT,
  ENVELOPE,
  NUCLEOID_STRAND,
  PORE,
  PROTO_FILM_LIGHT,
  OUTLINE,
  PROTO_GRANULE,
  RIBOSOME,
  SILICA_LIGHT,
  WHITE,
} from './colours';
import {
  SUBJECT_ALPHA,
  SUBJECT_RAMP,
  SUBJECT_STROKE,
  bodyGlint,
  rodLayers,
  roundBodyLayers,
} from './subject-glyph-motifs';
import * as kit from './trait-glyph-layers';

/** One body radius across the ladder, so the five rungs differ by what is on and in the cell, never by size. */
const STAGE = {
  radius: 27,
  organelleRadius: 8.5,
  nucleusRadius: 13,
  envelopeGap: 3.4,
  poreCount: 8,
  ribosomeCount: 10,
  spineCount: 12,
} as const;

/** The cell every rung is drawn on: one radius, one centre, so the ladder differs only by what is on and in it. */
function stageCellLayers(spec: {
  readonly ramp: shape.GlyphRamp;
  readonly rim: shape.GlyphStroke;
  readonly motion: shape.GlyphMotion;
  readonly opacity?: number;
}): readonly shape.GlyphLayer[] {
  return roundBodyLayers({ cx: 50, cy: 50, radius: STAGE.radius, ...spec });
}

const PROTOCELL: shape.SubjectGlyph = {
  entryId: 'stage:protocell',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    ...stageCellLayers({
      ramp: kit.GLYPH_RAMP.protocell,
      rim: kit.stroke(PROTO_FILM_LIGHT, SUBJECT_STROKE.rim),
      motion: kit.BREATHE,
      opacity: 0.45,
    }),
    /** The double film: a second, inner hairline a gap inside the membrane, which is all a protocell has. */
    kit.paint(shape.GLYPH_ROLE.signature, kit.centreCircle(STAGE.radius - STAGE.envelopeGap), {
      stroke: kit.stroke(WHITE, SUBJECT_STROKE.fine, SUBJECT_ALPHA.scatter),
      motion: kit.BREATHE,
    }),
    kit.paint(
      shape.GLYPH_ROLE.detail,
      shape.path(
        shape.dotsPath(
          [
            [42, 56],
            [56, 44],
            [58, 59],
          ],
          3,
        ),
      ),
      {
        fill: kit.solid(PROTO_GRANULE),
        stroke: kit.stroke(WHITE, SUBJECT_STROKE.hair, SUBJECT_ALPHA.wash),
        motion: kit.BREATHE,
      },
    ),
  ],
};

/**
 * A prokaryote leads with its **ribosomes**, standing proud of the membrane so the outline itself is bumpy. The
 * loose nucleoid is the Nucleoid Coil trait's silhouette — a pale disc with a white spiral — so it stays here only
 * as an interior detail the list LOD drops, and the studs are what names the rung.
 */
const NUCLEOID = shape.path('M36 54 C34 40 54 32 62 44 C69 55 54 66 46 59');
const PROKARYOTE: shape.SubjectGlyph = {
  entryId: 'stage:prokaryote',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    ...stageCellLayers({
      ramp: kit.GLYPH_RAMP.protocell,
      rim: kit.stroke(RIBOSOME, SUBJECT_STROKE.rim, SUBJECT_ALPHA.scatter),
      motion: kit.BREATHE,
      opacity: 0.55,
    }),
    kit.paint(shape.GLYPH_ROLE.detail, NUCLEOID, {
      stroke: kit.stroke(NUCLEOID_STRAND, SUBJECT_STROKE.fine, SUBJECT_ALPHA.wash),
      motion: kit.SPIN,
    }),
    kit.paint(
      shape.GLYPH_ROLE.signature,
      shape.path(
        shape.dotRingPath({
          ...kit.GLYPH_CENTRE_POINT,
          count: STAGE.ribosomeCount,
          ringRadius: STAGE.radius,
          dotRadius: 4.2,
          phaseTurns: 0.03,
        }),
      ),
      { fill: kit.solid(RIBOSOME), stroke: kit.stroke(OUTLINE, SUBJECT_STROKE.hair), motion: kit.BREATHE },
    ),
  ],
};

/** The swallowed rod crosses the membrane: the notch and the rod's free end are the tell on the silhouette. */
const SWALLOWED_ROD = { cx: 66, cy: 62, halfLength: 12, radius: 7.5, turns: -0.08 } as const;
const ENDOSYMBIOSIS: shape.SubjectGlyph = {
  entryId: 'stage:endosymbiosis',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    ...roundBodyLayers({
      cx: 44,
      cy: 46,
      radius: STAGE.radius,
      ramp: kit.GLYPH_RAMP.protocell,
      rim: kit.stroke(PROTO_FILM_LIGHT, SUBJECT_STROKE.rim, SUBJECT_ALPHA.scatter),
      motion: kit.BEAT,
    }),
    ...rodLayers({
      ...SWALLOWED_ROD,
      ramp: SUBJECT_RAMP.vent,
      rim: kit.stroke(SUBJECT_RAMP.vent.light, SUBJECT_STROKE.fine),
      motion: kit.BEAT,
      role: shape.GLYPH_ROLE.signature,
    }),
    /** The membrane dimples around what it is swallowing, the way the dish draws an engulf. */
    kit.paint(shape.GLYPH_ROLE.signature, shape.path('M56 36 C64 44 64 58 55 68'), {
      stroke: kit.stroke(PROTO_FILM_LIGHT, SUBJECT_STROKE.fine, SUBJECT_ALPHA.scatter),
      motion: kit.BEAT,
    }),
  ],
};

const EUKARYOTE: shape.SubjectGlyph = {
  entryId: 'stage:eukaryote',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    ...stageCellLayers({
      ramp: kit.GLYPH_RAMP.vacuole,
      rim: kit.stroke(ENVELOPE, SUBJECT_STROKE.rim, SUBJECT_ALPHA.scatter),
      motion: kit.BREATHE,
    }),
    ...roundBodyLayers({
      cx: 50,
      cy: 50,
      radius: STAGE.nucleusRadius,
      ramp: kit.GLYPH_RAMP.nucleus,
      rim: kit.stroke(ENVELOPE, SUBJECT_STROKE.hair),
    }),
    /** The double envelope, notched by its pores: the ring that says a nucleus is walled, not loose. */
    kit.paint(shape.GLYPH_ROLE.signature, kit.centreCircle(STAGE.nucleusRadius + STAGE.envelopeGap), {
      stroke: kit.stroke(ENVELOPE, SUBJECT_STROKE.rim),
      motion: kit.SPIN,
    }),
    kit.paint(
      shape.GLYPH_ROLE.signature,
      shape.path(
        shape.dotRingPath({
          ...kit.GLYPH_CENTRE_POINT,
          count: STAGE.poreCount,
          ringRadius: STAGE.nucleusRadius + STAGE.envelopeGap,
          dotRadius: 2.8,
          phaseTurns: 0,
        }),
      ),
      { fill: kit.solid(PORE), motion: kit.SPIN },
    ),
    bodyGlint(50, 50, STAGE.radius, kit.BREATHE),
  ],
};

const SPECIALISED: shape.SubjectGlyph = {
  entryId: 'stage:specialised',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.paint(
      shape.GLYPH_ROLE.signature,
      shape.path(
        shape.radialStrokesPath({
          ...kit.GLYPH_CENTRE_POINT,
          count: STAGE.spineCount,
          innerRadius: STAGE.radius - STAGE.envelopeGap,
          outerRadius: STAGE.radius + 8,
          leanTurns: 0,
          phaseTurns: 0.02,
        }),
      ),
      { stroke: kit.stroke(SILICA_LIGHT, SUBJECT_STROKE.fine), motion: kit.SPIN },
    ),
    ...stageCellLayers({
      ramp: kit.GLYPH_RAMP.silica,
      rim: kit.stroke(CELL_WALL_LIGHT, SUBJECT_STROKE.rim),
      motion: kit.BREATHE,
    }),
    /** Three organelles at once: a mitochondrion, a chloroplast and a vacuole — what "specialised" means. */
    ...roundBodyLayers({
      cx: 40,
      cy: 42,
      radius: STAGE.organelleRadius,
      ramp: kit.GLYPH_RAMP.mitochondrion,
      rim: kit.stroke(SUBJECT_RAMP.vent.light, SUBJECT_STROKE.hair),
      motion: kit.BEAT,
      role: shape.GLYPH_ROLE.signature,
    }),
    ...roundBodyLayers({
      cx: 60,
      cy: 46,
      radius: STAGE.organelleRadius,
      ramp: kit.GLYPH_RAMP.chloroplast,
      rim: kit.stroke(kit.GLYPH_RAMP.chloroplast.light, SUBJECT_STROKE.hair),
      role: shape.GLYPH_ROLE.signature,
    }),
    ...roundBodyLayers({
      cx: 49,
      cy: 61,
      radius: STAGE.organelleRadius,
      ramp: kit.GLYPH_RAMP.vacuole,
      rim: kit.stroke(kit.GLYPH_RAMP.vacuole.light, SUBJECT_STROKE.hair),
      role: shape.GLYPH_ROLE.signature,
    }),
  ],
};

export const STAGE_SUBJECT_GLYPHS: readonly shape.SubjectGlyph[] = [
  PROTOCELL,
  PROKARYOTE,
  ENDOSYMBIOSIS,
  EUKARYOTE,
  SPECIALISED,
];
