// What a cell eats, and the fragment it leaves (docs/visual-style/ui-type.md §7.2), each drawn as the dish draws it:
// the algae mote is a lit green disc with its dark edge band, detritus a squat lipid ellipse with a darker core, and a
// bacterium a stadium rod. The three rods share the dish's silhouette, so they separate on proportion — a plump
// aerobe, a long thin photosynthetic, a middling plain — plus one interior mark each, not on hue alone.

import { DNA_TAG } from '@evolution/shared';
import * as shape from '../svg-glyph';
import { CHLORO_DARK, DNA_TAG_COLOR, LIPID_LIGHT, LIPID_RIM, MITO_LIGHT, PROTO_FILM, PROTO_FILM_LIGHT, WHITE } from './colours';
import {
  SUBJECT_ALPHA,
  SUBJECT_RAMP,
  SUBJECT_STROKE,
  bodyGlint,
  helixLayers,
  rodLayers,
  roundBodyLayers,
} from './subject-glyph-motifs';
import { rodPath } from './subject-glyph-shapes';
import * as kit from './trait-glyph-layers';

/** The mote sizes, and the three rod proportions: the aerobe is plump, the photosynthetic long, the plain between. */
const FOOD = {
  moteRadius: 22,
  detritusRadiusX: 26,
  /** The dish draws detritus wider than tall (`DETRITUS_ASPECT` 0.85). */
  detritusRadiusY: 22,
  detritusCoreShare: 0.45,
  edgeRingShare: 0.86,
} as const;

const ROD = {
  plain: { halfLength: 16, radius: 11 },
  aerobic: { halfLength: 12, radius: 14 },
  photosynthetic: { halfLength: 21, radius: 9 },
  /** The photosynthetic rod's three bands sit across the middle half of its run (`BACTERIUM_BANDS`). */
  bandShares: [-0.333, 0, 0.333],
  bandWidth: 3.4,
  filmInset: 3.6,
} as const;

const ALGAE: shape.SubjectGlyph = {
  entryId: 'food:algae',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    ...roundBodyLayers({
      cx: 50,
      cy: 50,
      radius: FOOD.moteRadius,
      ramp: SUBJECT_RAMP.algae,
      rim: kit.stroke(SUBJECT_RAMP.algae.light, SUBJECT_STROKE.rim),
      motion: kit.BREATHE,
    }),
    kit.paint(shape.GLYPH_ROLE.signature, kit.centreCircle(FOOD.moteRadius * FOOD.edgeRingShare), {
      stroke: kit.stroke(SUBJECT_RAMP.algae.dark, SUBJECT_STROKE.mark, SUBJECT_ALPHA.scatter),
      motion: kit.BREATHE,
    }),
  ],
};

const DETRITUS_BODY = shape.ellipse(50, 50, FOOD.detritusRadiusX, FOOD.detritusRadiusY);
const DETRITUS: shape.SubjectGlyph = {
  entryId: 'food:detritus',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(kit.centreCircle(FOOD.detritusRadiusX * 1.5), SUBJECT_RAMP.lipid.base, SUBJECT_ALPHA.halo),
    ...kit.shadedBody({
      shape: DETRITUS_BODY,
      ramp: SUBJECT_RAMP.lipid,
      rim: kit.stroke(LIPID_RIM, SUBJECT_STROKE.rim),
      motion: kit.BREATHE,
    }),
    kit.paint(
      shape.GLYPH_ROLE.signature,
      shape.ellipse(
        50,
        50,
        FOOD.detritusRadiusX * FOOD.detritusCoreShare,
        FOOD.detritusRadiusY * FOOD.detritusCoreShare,
      ),
      { fill: kit.solid(SUBJECT_RAMP.lipid.dark, SUBJECT_ALPHA.scatter), motion: kit.BREATHE },
    ),
    /** The lipid glint is the dish's warm `LIPID_LIGHT`, not the white every other mote glints with. */
    {
      ...bodyGlint(50, 50, FOOD.detritusRadiusY, kit.BREATHE),
      fill: kit.solid(LIPID_LIGHT, kit.GLYPH_GLINT_OPACITY),
    },
  ],
};

/** A rod's interior mark: bands across a photosynthetic, one hot seam down an aerobe, a film line inside a plain. */
function bandsPath(halfLength: number, radius: number): string {
  return ROD.bandShares
    .map((share) => {
      const x = 50 + halfLength * share;
      return `M${x} ${50 - radius} L${x} ${50 + radius}`;
    })
    .join(' ');
}

const PLAIN_ROD: shape.SubjectGlyph = {
  entryId: 'bacterium:plain',
  tiltDeg: -18,
  layers: [
    ...rodLayers({
      cx: 50,
      cy: 50,
      ...ROD.plain,
      turns: 0,
      ramp: SUBJECT_RAMP.rod,
      rim: kit.stroke(PROTO_FILM, SUBJECT_STROKE.rim),
      motion: kit.BREATHE,
    }),
    kit.paint(
      shape.GLYPH_ROLE.signature,
      shape.path(
        rodPath({
          cx: 50,
          cy: 50,
          halfLength: ROD.plain.halfLength,
          radius: ROD.plain.radius - ROD.filmInset,
          turns: 0,
        }),
      ),
      { stroke: kit.stroke(PROTO_FILM_LIGHT, SUBJECT_STROKE.fine, SUBJECT_ALPHA.scatter), motion: kit.BREATHE },
    ),
  ],
};

const AEROBIC_ROD: shape.SubjectGlyph = {
  entryId: 'bacterium:aerobic',
  tiltDeg: 14,
  layers: [
    ...rodLayers({
      cx: 50,
      cy: 50,
      ...ROD.aerobic,
      turns: 0,
      ramp: kit.GLYPH_RAMP.mitochondrion,
      rim: kit.stroke(MITO_LIGHT, SUBJECT_STROKE.rim),
      motion: kit.BEAT,
    }),
    kit.paint(
      shape.GLYPH_ROLE.signature,
      shape.path(`M${50 - ROD.aerobic.halfLength} 50 L${50 + ROD.aerobic.halfLength} 50`),
      { stroke: kit.stroke(WHITE, SUBJECT_STROKE.mark, SUBJECT_ALPHA.scatter), motion: kit.BEAT },
    ),
  ],
};

const PHOTOSYNTHETIC_ROD: shape.SubjectGlyph = {
  entryId: 'bacterium:photosynthetic',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    ...rodLayers({
      cx: 50,
      cy: 50,
      ...ROD.photosynthetic,
      turns: 0,
      ramp: kit.GLYPH_RAMP.chloroplast,
      rim: kit.stroke(kit.GLYPH_RAMP.chloroplast.light, SUBJECT_STROKE.rim),
      motion: kit.BREATHE,
    }),
    kit.paint(
      shape.GLYPH_ROLE.signature,
      shape.path(bandsPath(ROD.photosynthetic.halfLength, ROD.photosynthetic.radius)),
      { stroke: kit.stroke(CHLORO_DARK, ROD.bandWidth, SUBJECT_ALPHA.scatter), motion: kit.BREATHE },
    ),
  ],
};

/** The food kind, not one variant: three rods of the three proportions, so the page reads as a class of rods. */
const BACTERIUM_FOOD: shape.SubjectGlyph = {
  entryId: 'food:bacterium',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(kit.centreCircle(30), SUBJECT_RAMP.accent.base, SUBJECT_ALPHA.wash),
    ...rodLayers({
      cx: 36,
      cy: 34,
      halfLength: 9,
      radius: 6,
      turns: 0.06,
      ramp: kit.GLYPH_RAMP.chloroplast,
      rim: kit.stroke(kit.GLYPH_RAMP.chloroplast.light, SUBJECT_STROKE.hair),
    }),
    ...rodLayers({
      cx: 62,
      cy: 46,
      halfLength: 7,
      radius: 7,
      turns: -0.09,
      ramp: SUBJECT_RAMP.vent,
      rim: kit.stroke(MITO_LIGHT, SUBJECT_STROKE.hair),
    }),
    ...rodLayers({
      cx: 45,
      cy: 65,
      halfLength: 12,
      radius: 8,
      turns: 0.03,
      ramp: SUBJECT_RAMP.rod,
      rim: kit.stroke(SUBJECT_RAMP.rod.light, SUBJECT_STROKE.rim),
      motion: kit.BREATHE,
      role: shape.GLYPH_ROLE.signature,
    }),
  ],
};

const DNA_FRAGMENT: shape.SubjectGlyph = {
  entryId: 'entity:dna_fragment',
  tiltDeg: -14,
  layers: [
    ...helixLayers({
      fromX: 16,
      toX: 84,
      y: 50,
      amplitude: 15,
      waves: 1,
      rungCount: 5,
      rungColour: DNA_TAG_COLOR[DNA_TAG.motile],
      motion: kit.BREATHE,
    }),
    bodyGlint(30, 44, 12, kit.BREATHE),
  ],
};

export const FOOD_SUBJECT_GLYPHS: readonly shape.SubjectGlyph[] = [
  ALGAE,
  DETRITUS,
  BACTERIUM_FOOD,
  PLAIN_ROD,
  AEROBIC_ROD,
  PHOTOSYNTHETIC_ROD,
  DNA_FRAGMENT,
];
