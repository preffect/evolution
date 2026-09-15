// The trait glyphs of the five forms (docs/visual-style/ui-type.md §7.1): the sheet-04 body plans, each drawn from
// its organelle vocabulary (visual-style/cells-and-organelles.md §4) in the 100 × 100 glyph box. Draw order is the
// array order.

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
  CHLORO_DARK,
  CHLORO_LIGHT,
  CILIA,
  DIATOM_PLASTID_DARK,
  DIATOM_PLASTID_LIGHT,
  ENVELOPE,
  EYESPOT,
  EYESPOT_RIM,
  FLAGELLUM,
  MITO_BASE,
  SILICA_BASE,
  SILICA_DARK,
  SILICA_LIGHT,
  TOXIN_GLOW,
  VAC_BASE,
  VAC_RIM,
  WHITE,
} from './colours';
import {
  BREATHE,
  GLYPH_RAMP,
  SPIN,
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

const AMOEBA_BODY = path(
  'M50 18 C60 18 62 29 70 29 C84 29 89 46 79 54 C73 60 85 70 75 78 C65 86 56 74 48 79 C36 85 21 79 23 66 C25 58 13 52 17 42 C21 30 39 33 41 25 C43 19 46 18 50 18 Z',
);
const AMOEBA_PSEUDOPODS: TraitGlyph = {
  traitId: 'amoeba_pseudopods',
  tiltDeg: NO_TILT,
  layers: [
    haloLayer(circle(50, 50, 44), VAC_BASE, 0.35),
    ...shadedBody({
      shape: AMOEBA_BODY,
      ramp: GLYPH_RAMP.vacuole,
      rim: stroke(VAC_RIM, 2.6, 0.6),
      opacity: 0.85,
      motion: BREATHE,
    }),
    paint(detail, path('M50 33 C62 33 70 43 66 55 C62 65 50 68 40 62 C30 56 34 39 50 33 Z'), {
      fill: solid(VAC_RIM, 0.18),
      motion: BREATHE,
    }),
    paint(detail, circle(39, 59, 4.5), { fill: solid(MITO_BASE, 0.8), motion: BREATHE }),
    paint(signature, circle(53, 49, 7), {
      fill: solid(ENVELOPE, 0.9),
      stroke: stroke(SILICA_DARK, 1, 0.6),
      motion: BREATHE,
    }),
    glintLayer(ellipse(36, 35, 5, 3), BREATHE),
  ],
};

const SLIPPER = path(
  'M16 50 C16 38 32 32 50 34 C62 35 66 40 76 38 C86 36 89 46 86 54 C84 64 70 68 50 66 C30 64 16 62 16 50 Z',
);
const FRINGE_BEAT = motion(GLYPH_MOTION.sway);
const PARAMECIUM_CILIA: TraitGlyph = {
  traitId: 'paramecium_cilia',
  tiltDeg: -28,
  layers: [
    haloLayer(ellipse(52, 50, 44, 26), CILIA, 0.35),
    paint(signature, SLIPPER, { stroke: stroke(CILIA, 7, 0.85, '0.9 2.4'), motion: FRINGE_BEAT }),
    ...shadedBody({ shape: SLIPPER, ramp: GLYPH_RAMP.vacuole, rim: stroke(VAC_RIM, 1.4, 0.8), opacity: 0.9 }),
    paint(detail, ellipse(36, 50, 9, 6), { fill: solid(ENVELOPE, 0.5) }),
    paint(
      detail,
      path(
        dotsPath(
          [
            [25, 48],
            [74, 50],
          ],
          3,
        ),
      ),
      { stroke: stroke(VAC_RIM, 1, 0.7) },
    ),
    paint(signature, path('M56 37 C62 46 60 54 51 58'), { stroke: stroke(SILICA_DARK, 2.6, 0.85) }),
    glintLayer(ellipse(30, 42, 6, 2.6)),
  ],
};

const SPINDLE = path('M14 52 C26 38 58 36 80 46 C85 48 85 52 80 54 C58 64 26 64 14 52 Z');
const EUGLENA_FLAGELLUM = path('M82 50 C88 42 90 34 86 22');
const FLAGELLUM_WAG = motion(GLYPH_MOTION.sway, 82, 50);
const EUGLENA_EYESPOT: TraitGlyph = {
  traitId: 'euglena_eyespot',
  tiltDeg: -18,
  layers: [
    haloLayer(ellipse(50, 50, 44, 24), CHLORO_LIGHT, 0.35),
    outlineLayer(EUGLENA_FLAGELLUM, 4, FLAGELLUM_WAG),
    paint(signature, EUGLENA_FLAGELLUM, { stroke: stroke(FLAGELLUM, 4, 0.5), motion: FLAGELLUM_WAG }),
    paint(signature, EUGLENA_FLAGELLUM, { stroke: stroke(WHITE, 1.6), motion: FLAGELLUM_WAG }),
    ...shadedBody({
      shape: SPINDLE,
      ramp: GLYPH_RAMP.chloroplast,
      rim: stroke(CHLORO_LIGHT, 1.4, 0.8),
      opacity: 0.85,
      motion: BREATHE,
    }),
    paint(
      detail,
      path(
        dotsPath(
          [
            [30, 52],
            [40, 49],
            [47, 56],
            [57, 51],
            [63, 56],
          ],
          3.2,
        ),
      ),
      {
        fill: solid(CHLORO_DARK, 0.7),
        motion: BREATHE,
      },
    ),
    haloLayer(circle(71, 50, 9), EYESPOT, 0.6),
    paint(signature, circle(71, 50, 4.2), { fill: solid(EYESPOT), stroke: stroke(EYESPOT_RIM, 1.2, 0.9) }),
    glintLayer(ellipse(28, 47, 6, 2.2), BREATHE),
  ],
};

const DIATOM_SPINES = path(
  radialStrokesPath({ cx: 50, cy: 50, count: 8, innerRadius: 22, outerRadius: 40, leanTurns: 0, phaseTurns: 0.0625 }),
);
const DIATOM_SHELL: TraitGlyph = {
  traitId: 'diatom_shell',
  tiltDeg: NO_TILT,
  layers: [
    haloLayer(circle(50, 50, 46), SILICA_BASE, 0.35),
    outlineLayer(DIATOM_SPINES, 2, SPIN),
    paint(signature, DIATOM_SPINES, { stroke: stroke(SILICA_LIGHT, 2, 0.95), motion: SPIN }),
    paint(
      GLYPH_ROLE.halo,
      path(dotRingPath({ cx: 50, cy: 50, count: 8, ringRadius: 40, dotRadius: 3.6, phaseTurns: 0.0625 })),
      {
        fill: solid(SILICA_LIGHT, 0.35),
        motion: SPIN,
      },
    ),
    paint(
      signature,
      path(dotRingPath({ cx: 50, cy: 50, count: 8, ringRadius: 40, dotRadius: 1.8, phaseTurns: 0.0625 })),
      {
        fill: solid(WHITE),
        motion: SPIN,
      },
    ),
    ...shadedBody({ shape: circle(50, 50, 22), ramp: GLYPH_RAMP.silica, rim: stroke(SILICA_LIGHT, 1.6, 0.95) }),
    paint(
      detail,
      path(
        radialStrokesPath({ cx: 50, cy: 50, count: 36, innerRadius: 7, outerRadius: 20, leanTurns: 0, phaseTurns: 0 }),
      ),
      {
        stroke: stroke(SILICA_DARK, 0.8, 0.5),
        motion: SPIN,
      },
    ),
    paint(signature, path('M38 44 C44 36 60 38 62 48 C60 58 44 62 38 54 C35 50 35 47 38 44 Z'), {
      fill: solid(DIATOM_PLASTID_LIGHT, 0.75),
      stroke: stroke(DIATOM_PLASTID_DARK, 1, 0.8),
    }),
    glintLayer(ellipse(42, 39, 5, 2.6)),
  ],
};

const TRUMPET = path(
  'M46 86 C44 70 40 56 28 36 C24 29 22 23 26 20 C40 16 60 16 74 20 C78 23 76 29 72 36 C60 56 56 70 54 86 Z',
);
const STALK_SWAY = motion(GLYPH_MOTION.sway, 50, 86);
const STENTOR_TRUMPET: TraitGlyph = {
  traitId: 'stentor_trumpet',
  tiltDeg: NO_TILT,
  layers: [
    haloLayer(circle(50, 48, 44), TOXIN_GLOW, 0.22),
    ...shadedBody({
      shape: TRUMPET,
      ramp: GLYPH_RAMP.vacuole,
      rim: stroke(VAC_RIM, 1.4, 0.8),
      opacity: 0.85,
      motion: STALK_SWAY,
    }),
    paint(detail, path('M36 30 C42 50 46 66 49 84 M50 22 L50 84 M64 30 C58 50 54 66 51 84'), {
      stroke: stroke(SILICA_DARK, 0.8, 0.35),
      motion: STALK_SWAY,
    }),
    paint(detail, ellipse(50, 22, 20, 3.6), { fill: solid(SILICA_DARK, 0.45), motion: STALK_SWAY }),
    paint(signature, ellipse(50, 21, 25, 5.5), { stroke: stroke(CILIA, 4, 0.9, '1 2.2'), motion: STALK_SWAY }),
    paint(
      signature,
      path(
        dotsPath(
          [
            [44, 34],
            [46.5, 41],
            [48.5, 48],
            [50, 55],
            [50.5, 62],
            [50.5, 69],
            [50.5, 76],
          ],
          2.8,
        ),
      ),
      {
        fill: solid(ENVELOPE, 0.9),
        stroke: stroke(SILICA_DARK, 0.6, 0.6),
        motion: STALK_SWAY,
      },
    ),
    glintLayer(ellipse(36, 28, 5, 2.4), STALK_SWAY),
  ],
};

/** The forms, in catalog order. */
export const FORM_TRAIT_GLYPHS: readonly TraitGlyph[] = [
  AMOEBA_PSEUDOPODS,
  PARAMECIUM_CILIA,
  EUGLENA_EYESPOT,
  DIATOM_SHELL,
  STENTOR_TRUMPET,
];
