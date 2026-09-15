// The trait glyphs of the eukaryote organelles (docs/visual-style/ui-type.md §7.1): the nuclear envelope, the
// cytoskeleton, cilia and the two vacuoles, each drawn from its organelle vocabulary
// (visual-style/cells-and-organelles.md §4) in the 100 × 100 glyph box. Draw order is the array order.

import * as shape from '../svg-glyph';
import {
  BLACK,
  CILIA,
  CYTOSKELETON,
  ENVELOPE,
  MITO_BASE,
  MITO_DARK,
  MITO_LIGHT,
  NUCLEOID_GLOW,
  OUTLINE,
  PORE,
  PROTO_FILM_LIGHT,
  PROTO_GRANULE,
  SILICA_DARK,
  TOXIN_GLOW,
  TOXIN_RIM,
} from './colours';
import * as kit from './trait-glyph-layers';

// Eight pore notches cut the outer ring: each dash is an eighth of its circumference less one 6-unit pore. A circle's
// path starts at its left edge and runs anticlockwise on screen, so the first notch is centred 5.54 degrees clockwise
// of 3 o'clock, which is where the pore dots sit. The dashes end square, so the list LOD's thicker stroke keeps them open.
const ENVELOPE_PORE_DASH = '18.35 6';
const NUCLEAR_ENVELOPE: shape.TraitGlyph = {
  traitId: 'nuclear_envelope',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(kit.centreCircle(42), NUCLEOID_GLOW, 0.4),
    kit.paint(shape.GLYPH_ROLE.outline, kit.centreCircle(31), {
      stroke: kit.stroke(OUTLINE, 8, 0.9, ENVELOPE_PORE_DASH),
      motion: kit.SPIN,
    }),
    ...kit.shadedBody({ shape: kit.centreCircle(22), ramp: kit.GLYPH_RAMP.nucleus, rim: kit.stroke(ENVELOPE, 1, 0.6) }),
    kit.paint(
      shape.GLYPH_ROLE.detail,
      shape.path(
        shape.dotsPath(
          [
            [43, 47],
            [55, 44],
            [46, 57],
            [41, 54],
          ],
          2.2,
        ),
      ),
      { fill: kit.solid(BLACK, 0.22) },
    ),
    kit.paint(shape.GLYPH_ROLE.detail, shape.circle(56, 54, 5.5), { fill: kit.solid(SILICA_DARK, 0.55) }),
    kit.paint(shape.GLYPH_ROLE.signature, kit.centreCircle(25.5), { stroke: kit.stroke(ENVELOPE, 1.6, 0.9) }),
    kit.paint(shape.GLYPH_ROLE.signature, kit.centreCircle(31), {
      stroke: kit.stroke(ENVELOPE, 5, 0.95, ENVELOPE_PORE_DASH),
      motion: kit.SPIN,
    }),
    kit.paint(
      shape.GLYPH_ROLE.signature,
      shape.path(
        shape.dotRingPath({ ...kit.GLYPH_CENTRE_POINT, count: 8, ringRadius: 31, dotRadius: 1.5, phaseTurns: 0.0154 }),
      ),
      {
        fill: kit.solid(PORE),
        motion: kit.SPIN,
      },
    ),
    kit.glintLayer(shape.ellipse(42, 42, 5, 3)),
  ],
};

// Eleven spokes run out past a smaller membrane, so the outline carries the lattice at 20 px; they end at 38 units,
// inside the medallion at the list LOD's zoom.
const CYTOSKELETON_SPOKES = shape.path(
  shape.radialStrokesPath({
    ...kit.GLYPH_CENTRE_POINT,
    count: 11,
    innerRadius: 8,
    outerRadius: 38,
    leanTurns: 0,
    phaseTurns: -0.25,
  }),
);
const CYTOSKELETON_GLYPH: shape.TraitGlyph = {
  traitId: 'cytoskeleton',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(kit.centreCircle(42), CYTOSKELETON, 0.35),
    kit.outlineLayer(CYTOSKELETON_SPOKES, 2.4, kit.BREATHE),
    ...kit.shadedBody({
      shape: kit.centreCircle(27),
      ramp: kit.GLYPH_RAMP.protocell,
      rim: kit.stroke(CYTOSKELETON, 2, 0.85),
      opacity: 0.45,
      motion: kit.BREATHE,
    }),
    kit.paint(shape.GLYPH_ROLE.detail, kit.centreCircle(18), {
      stroke: kit.stroke(CYTOSKELETON, 1, 0.45, '3 2.2'),
      motion: kit.BREATHE,
    }),
    kit.paint(shape.GLYPH_ROLE.detail, kit.centreCircle(11), {
      stroke: kit.stroke(CYTOSKELETON, 1, 0.35, '2 2'),
      motion: kit.BREATHE,
    }),
    kit.paint(shape.GLYPH_ROLE.signature, CYTOSKELETON_SPOKES, {
      stroke: kit.stroke(CYTOSKELETON, 2.4, 0.9),
      motion: kit.BREATHE,
    }),
    kit.bodyLayer(
      { shape: kit.centreCircle(8), ramp: kit.GLYPH_RAMP.nucleus, rim: kit.stroke(ENVELOPE, 1, 0.7) },
      shape.GLYPH_ROLE.signature,
    ),
    kit.glintLayer(shape.ellipse(40, 36, 5, 3), kit.BREATHE),
  ],
};

// Long hairs past the membrane: the fringe, not the disc, is the outline at 20 px. They end at 39 units so the list
// LOD's 1.2x zoom keeps them inside the medallion, and 20 thin leaning hairs leave gaps at 20 px, where 28 filled in
// to a disc; the cytoskeleton's 11 straight spokes stay the star.
const CILIA_HAIRS = shape.path(
  shape.radialStrokesPath({
    ...kit.GLYPH_CENTRE_POINT,
    count: 20,
    innerRadius: 22,
    outerRadius: 39,
    leanTurns: 0.035,
    phaseTurns: 0,
  }),
);
const CILIA_BEAT = kit.motion(shape.GLYPH_MOTION.sway);
const CILIA_GLYPH: shape.TraitGlyph = {
  traitId: 'cilia',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(kit.centreCircle(44), CILIA, 0.35),
    kit.outlineLayer(CILIA_HAIRS, 1.5, CILIA_BEAT),
    kit.paint(shape.GLYPH_ROLE.signature, CILIA_HAIRS, { stroke: kit.stroke(CILIA, 1.5, 0.95), motion: CILIA_BEAT }),
    ...kit.shadedBody({
      shape: kit.centreCircle(24),
      ramp: kit.GLYPH_RAMP.protocell,
      rim: kit.stroke(PROTO_FILM_LIGHT, 1.5, 0.8),
      opacity: 0.85,
    }),
    kit.paint(
      shape.GLYPH_ROLE.detail,
      shape.path(
        shape.dotsPath(
          [
            [44, 55],
            [57, 47],
            [52, 59],
          ],
          2,
        ),
      ),
      { fill: kit.solid(PROTO_GRANULE, 0.6) },
    ),
    kit.glintLayer(shape.ellipse(42, 40, 5, 3)),
  ],
};

const VACUOLE_RISE = kit.motion(shape.GLYPH_MOTION.rise);
const FOOD_VACUOLE: shape.TraitGlyph = {
  traitId: 'food_vacuole',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(shape.circle(48, 50, 38), MITO_BASE, 0.35),
    ...kit.shadedBody({
      shape: shape.circle(46, 60, 16),
      ramp: kit.GLYPH_RAMP.mitochondrion,
      rim: kit.stroke(MITO_LIGHT, 1.6, 0.95),
      opacity: 0.6,
    }),
    kit.paint(shape.GLYPH_ROLE.detail, shape.circle(49, 63, 5.5), { fill: kit.solid(MITO_DARK, 0.8) }),
    kit.outlineLayer(shape.circle(64, 36, 9.5), 1.4, VACUOLE_RISE),
    kit.bodyLayer(
      {
        shape: shape.circle(64, 36, 9.5),
        ramp: kit.GLYPH_RAMP.mitochondrion,
        rim: kit.stroke(MITO_LIGHT, 1.4, 0.95),
        opacity: 0.6,
        motion: VACUOLE_RISE,
      },
      shape.GLYPH_ROLE.signature,
    ),
    kit.outlineLayer(shape.circle(36, 32, 6), 1.2, VACUOLE_RISE),
    kit.bodyLayer(
      {
        shape: shape.circle(36, 32, 6),
        ramp: kit.GLYPH_RAMP.mitochondrion,
        rim: kit.stroke(MITO_LIGHT, 1.2, 0.95),
        opacity: 0.6,
        motion: VACUOLE_RISE,
      },
      shape.GLYPH_ROLE.signature,
    ),
    kit.glintLayer(shape.ellipse(40, 52, 5, 2.6)),
    kit.glintLayer(shape.circle(61, 33, 2), VACUOLE_RISE),
  ],
};

const TOXIN_WISPS = shape.path('M60 36 C66 28 60 22 68 14 M68 48 C78 44 80 36 88 34 M50 32 C50 24 44 20 48 12');
const TOXIN_PULSE = kit.motion(shape.GLYPH_MOTION.beat, 46, 56);
const TOXIN_DRIFT = kit.motion(shape.GLYPH_MOTION.sway, 56, 44);
const TOXIN_VACUOLE: shape.TraitGlyph = {
  traitId: 'toxin_vacuole',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(shape.circle(50, 52, 42), TOXIN_GLOW, 0.5),
    kit.outlineLayer(TOXIN_WISPS, 2.6, TOXIN_DRIFT),
    kit.paint(shape.GLYPH_ROLE.signature, TOXIN_WISPS, {
      stroke: kit.stroke(TOXIN_GLOW, 2.6, 0.8),
      motion: TOXIN_DRIFT,
    }),
    ...kit.shadedBody({
      shape: shape.circle(46, 56, 23),
      ramp: kit.GLYPH_RAMP.toxin,
      rim: kit.stroke(TOXIN_RIM, 2, 0.95),
      motion: TOXIN_PULSE,
    }),
    kit.paint(
      shape.GLYPH_ROLE.detail,
      shape.path(
        shape.dotsPath(
          [
            [40, 61],
            [53, 51],
            [49, 67],
          ],
          2.4,
        ),
      ),
      { fill: kit.solid(TOXIN_RIM, 0.55), motion: TOXIN_PULSE },
    ),
    kit.glintLayer(shape.ellipse(38, 46, 6, 3), TOXIN_PULSE),
  ],
};

/** The nuclear envelope, cytoskeleton, cilia and the vacuoles, in catalog order. */
export const ORGANELLE_TRAIT_GLYPHS: readonly shape.TraitGlyph[] = [
  NUCLEAR_ENVELOPE,
  CYTOSKELETON_GLYPH,
  CILIA_GLYPH,
  FOOD_VACUOLE,
  TOXIN_VACUOLE,
];
