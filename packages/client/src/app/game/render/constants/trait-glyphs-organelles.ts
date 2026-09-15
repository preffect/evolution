// The trait glyphs of the eukaryote organelles (docs/visual-style/ui-type.md §7.1): the nuclear envelope, the
// cytoskeleton, cilia and the two vacuoles, each drawn from its organelle vocabulary
// (visual-style/cells-and-organelles.md §4) in the 100 × 100 glyph box. Draw order is the array order.

import {
  GLYPH_MOTION,
  GLYPH_ROLE,
  circle,
  dotRingPath,
  dotsPath,
  ellipse,
  path,
  radialStrokesPath,
  type TraitGlyph,
} from '../svg-glyph';
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
import {
  BREATHE,
  GLYPH_RAMP,
  SPIN,
  bodyLayer,
  glintLayer,
  haloLayer,
  motion,
  outlineLayer,
  paint,
  shadedBody,
  solid,
  stroke,
} from './trait-glyph-layers';

const { detail, signature } = GLYPH_ROLE;
const NO_TILT = 0;

// Eight pore notches cut the outer ring: each dash is an eighth of its circumference less one 6-unit pore. A circle's
// path starts at its left edge and runs anticlockwise on screen, so the first notch is centred 5.54 degrees clockwise
// of 3 o'clock, which is where the pore dots sit. The dashes end square, so the list LOD's thicker stroke keeps them open.
const ENVELOPE_PORE_DASH = '18.35 6';
const NUCLEAR_ENVELOPE: TraitGlyph = {
  traitId: 'nuclear_envelope',
  tiltDeg: NO_TILT,
  layers: [
    haloLayer(circle(50, 50, 42), NUCLEOID_GLOW, 0.4),
    paint(GLYPH_ROLE.outline, circle(50, 50, 31), {
      stroke: stroke(OUTLINE, 8, 0.9, ENVELOPE_PORE_DASH),
      motion: SPIN,
    }),
    ...shadedBody({ shape: circle(50, 50, 22), ramp: GLYPH_RAMP.nucleus, rim: stroke(ENVELOPE, 1, 0.6) }),
    paint(
      detail,
      path(
        dotsPath(
          [
            [43, 47],
            [55, 44],
            [46, 57],
            [41, 54],
          ],
          2.2,
        ),
      ),
      { fill: solid(BLACK, 0.22) },
    ),
    paint(detail, circle(56, 54, 5.5), { fill: solid(SILICA_DARK, 0.55) }),
    paint(signature, circle(50, 50, 25.5), { stroke: stroke(ENVELOPE, 1.6, 0.9) }),
    paint(signature, circle(50, 50, 31), { stroke: stroke(ENVELOPE, 5, 0.95, ENVELOPE_PORE_DASH), motion: SPIN }),
    paint(
      signature,
      path(dotRingPath({ cx: 50, cy: 50, count: 8, ringRadius: 31, dotRadius: 1.5, phaseTurns: 0.0154 })),
      {
        fill: solid(PORE),
        motion: SPIN,
      },
    ),
    glintLayer(ellipse(42, 42, 5, 3)),
  ],
};

// Eleven spokes run out past a smaller membrane, so the outline carries the lattice at 20 px; they end at 38 units,
// inside the medallion at the list LOD's zoom.
const CYTOSKELETON_SPOKES = path(
  radialStrokesPath({ cx: 50, cy: 50, count: 11, innerRadius: 8, outerRadius: 38, leanTurns: 0, phaseTurns: -0.25 }),
);
const CYTOSKELETON_GLYPH: TraitGlyph = {
  traitId: 'cytoskeleton',
  tiltDeg: NO_TILT,
  layers: [
    haloLayer(circle(50, 50, 42), CYTOSKELETON, 0.35),
    outlineLayer(CYTOSKELETON_SPOKES, 2.4, BREATHE),
    ...shadedBody({
      shape: circle(50, 50, 27),
      ramp: GLYPH_RAMP.protocell,
      rim: stroke(CYTOSKELETON, 2, 0.85),
      opacity: 0.45,
      motion: BREATHE,
    }),
    paint(detail, circle(50, 50, 18), { stroke: stroke(CYTOSKELETON, 1, 0.45, '3 2.2'), motion: BREATHE }),
    paint(detail, circle(50, 50, 11), { stroke: stroke(CYTOSKELETON, 1, 0.35, '2 2'), motion: BREATHE }),
    paint(signature, CYTOSKELETON_SPOKES, { stroke: stroke(CYTOSKELETON, 2.4, 0.9), motion: BREATHE }),
    bodyLayer({ shape: circle(50, 50, 8), ramp: GLYPH_RAMP.nucleus, rim: stroke(ENVELOPE, 1, 0.7) }, signature),
    glintLayer(ellipse(40, 36, 5, 3), BREATHE),
  ],
};

// Long hairs past the membrane: the fringe, not the disc, is the outline at 20 px. They end at 39 units so the list
// LOD's 1.2x zoom keeps them inside the medallion, and 20 thin leaning hairs leave gaps at 20 px, where 28 filled in
// to a disc; the cytoskeleton's 11 straight spokes stay the star.
const CILIA_HAIRS = path(
  radialStrokesPath({ cx: 50, cy: 50, count: 20, innerRadius: 22, outerRadius: 39, leanTurns: 0.035, phaseTurns: 0 }),
);
const CILIA_BEAT = motion(GLYPH_MOTION.sway);
const CILIA_GLYPH: TraitGlyph = {
  traitId: 'cilia',
  tiltDeg: NO_TILT,
  layers: [
    haloLayer(circle(50, 50, 44), CILIA, 0.35),
    outlineLayer(CILIA_HAIRS, 1.5, CILIA_BEAT),
    paint(signature, CILIA_HAIRS, { stroke: stroke(CILIA, 1.5, 0.95), motion: CILIA_BEAT }),
    ...shadedBody({
      shape: circle(50, 50, 24),
      ramp: GLYPH_RAMP.protocell,
      rim: stroke(PROTO_FILM_LIGHT, 1.5, 0.8),
      opacity: 0.85,
    }),
    paint(
      detail,
      path(
        dotsPath(
          [
            [44, 55],
            [57, 47],
            [52, 59],
          ],
          2,
        ),
      ),
      { fill: solid(PROTO_GRANULE, 0.6) },
    ),
    glintLayer(ellipse(42, 40, 5, 3)),
  ],
};

const VACUOLE_RISE = motion(GLYPH_MOTION.rise);
const FOOD_VACUOLE: TraitGlyph = {
  traitId: 'food_vacuole',
  tiltDeg: NO_TILT,
  layers: [
    haloLayer(circle(48, 50, 38), MITO_BASE, 0.35),
    ...shadedBody({
      shape: circle(46, 60, 16),
      ramp: GLYPH_RAMP.mitochondrion,
      rim: stroke(MITO_LIGHT, 1.6, 0.95),
      opacity: 0.6,
    }),
    paint(detail, circle(49, 63, 5.5), { fill: solid(MITO_DARK, 0.8) }),
    outlineLayer(circle(64, 36, 9.5), 1.4, VACUOLE_RISE),
    bodyLayer(
      {
        shape: circle(64, 36, 9.5),
        ramp: GLYPH_RAMP.mitochondrion,
        rim: stroke(MITO_LIGHT, 1.4, 0.95),
        opacity: 0.6,
        motion: VACUOLE_RISE,
      },
      signature,
    ),
    outlineLayer(circle(36, 32, 6), 1.2, VACUOLE_RISE),
    bodyLayer(
      {
        shape: circle(36, 32, 6),
        ramp: GLYPH_RAMP.mitochondrion,
        rim: stroke(MITO_LIGHT, 1.2, 0.95),
        opacity: 0.6,
        motion: VACUOLE_RISE,
      },
      signature,
    ),
    glintLayer(ellipse(40, 52, 5, 2.6)),
    glintLayer(circle(61, 33, 2), VACUOLE_RISE),
  ],
};

const TOXIN_WISPS = path('M60 36 C66 28 60 22 68 14 M68 48 C78 44 80 36 88 34 M50 32 C50 24 44 20 48 12');
const TOXIN_PULSE = motion(GLYPH_MOTION.beat, 46, 56);
const TOXIN_DRIFT = motion(GLYPH_MOTION.sway, 56, 44);
const TOXIN_VACUOLE: TraitGlyph = {
  traitId: 'toxin_vacuole',
  tiltDeg: NO_TILT,
  layers: [
    haloLayer(circle(50, 52, 42), TOXIN_GLOW, 0.5),
    outlineLayer(TOXIN_WISPS, 2.6, TOXIN_DRIFT),
    paint(signature, TOXIN_WISPS, { stroke: stroke(TOXIN_GLOW, 2.6, 0.8), motion: TOXIN_DRIFT }),
    ...shadedBody({
      shape: circle(46, 56, 23),
      ramp: GLYPH_RAMP.toxin,
      rim: stroke(TOXIN_RIM, 2, 0.95),
      motion: TOXIN_PULSE,
    }),
    paint(
      detail,
      path(
        dotsPath(
          [
            [40, 61],
            [53, 51],
            [49, 67],
          ],
          2.4,
        ),
      ),
      { fill: solid(TOXIN_RIM, 0.55), motion: TOXIN_PULSE },
    ),
    glintLayer(ellipse(38, 46, 6, 3), TOXIN_PULSE),
  ],
};

/** The nuclear envelope, cytoskeleton, cilia and the vacuoles, in catalog order. */
export const ORGANELLE_TRAIT_GLYPHS: readonly TraitGlyph[] = [
  NUCLEAR_ENVELOPE,
  CYTOSKELETON_GLYPH,
  CILIA_GLYPH,
  FOOD_VACUOLE,
  TOXIN_VACUOLE,
];
