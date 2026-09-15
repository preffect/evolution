// The trait glyphs of the five forms (docs/visual-style/ui-type.md §7.1): the sheet-04 body plans, each drawn from
// its organelle vocabulary (visual-style/cells-and-organelles.md §4) in the 100 × 100 glyph box. Draw order is the
// array order.

import * as shape from '../svg-glyph';
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
import * as kit from './trait-glyph-layers';

const AMOEBA_BODY = shape.path(
  'M50 18 C60 18 62 29 70 29 C84 29 89 46 79 54 C73 60 85 70 75 78 C65 86 56 74 48 79 C36 85 21 79 23 66 C25 58 13 52 17 42 C21 30 39 33 41 25 C43 19 46 18 50 18 Z',
);
const AMOEBA_PSEUDOPODS: shape.TraitGlyph = {
  traitId: 'amoeba_pseudopods',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(kit.centreCircle(44), VAC_BASE, 0.35),
    ...kit.shadedBody({
      shape: AMOEBA_BODY,
      ramp: kit.GLYPH_RAMP.vacuole,
      rim: kit.stroke(VAC_RIM, 2.6, 0.6),
      opacity: 0.85,
      motion: kit.BREATHE,
    }),
    kit.paint(
      shape.GLYPH_ROLE.detail,
      shape.path('M50 33 C62 33 70 43 66 55 C62 65 50 68 40 62 C30 56 34 39 50 33 Z'),
      {
        fill: kit.solid(VAC_RIM, 0.18),
        motion: kit.BREATHE,
      },
    ),
    kit.paint(shape.GLYPH_ROLE.detail, shape.circle(39, 59, 4.5), {
      fill: kit.solid(MITO_BASE, 0.8),
      motion: kit.BREATHE,
    }),
    kit.paint(shape.GLYPH_ROLE.signature, shape.circle(53, 49, 7), {
      fill: kit.solid(ENVELOPE, 0.9),
      stroke: kit.stroke(SILICA_DARK, 1, 0.6),
      motion: kit.BREATHE,
    }),
    kit.glintLayer(shape.ellipse(36, 35, 5, 3), kit.BREATHE),
  ],
};

// The oral groove notches the slipper's upper edge, so the outline differs from a plain lens at 20 px.
const SLIPPER = shape.path(
  'M16 50 C16 38 32 32 46 34 C52 35 52 45 58 45 C63 45 65 38 76 38 C86 36 89 46 86 54 C84 64 70 68 50 66 C30 64 16 62 16 50 Z',
);
const FRINGE_BEAT = kit.motion(shape.GLYPH_MOTION.sway);
const PARAMECIUM_CILIA: shape.TraitGlyph = {
  traitId: 'paramecium_cilia',
  tiltDeg: -28,
  layers: [
    kit.haloLayer(shape.ellipse(52, 50, 44, 26), CILIA, 0.35),
    kit.paint(shape.GLYPH_ROLE.signature, SLIPPER, {
      stroke: kit.stroke(CILIA, 7, 0.85, '0.9 2.4'),
      motion: FRINGE_BEAT,
    }),
    ...kit.shadedBody({
      shape: SLIPPER,
      ramp: kit.GLYPH_RAMP.vacuole,
      rim: kit.stroke(VAC_RIM, 1.4, 0.8),
      opacity: 0.9,
    }),
    kit.paint(shape.GLYPH_ROLE.detail, shape.ellipse(36, 50, 9, 6), { fill: kit.solid(ENVELOPE, 0.5) }),
    kit.paint(
      shape.GLYPH_ROLE.detail,
      shape.path(
        shape.dotsPath(
          [
            [25, 48],
            [74, 50],
          ],
          3,
        ),
      ),
      { stroke: kit.stroke(VAC_RIM, 1, 0.7) },
    ),
    kit.paint(shape.GLYPH_ROLE.signature, shape.path('M58 46 C61 51 58 56 51 58'), {
      stroke: kit.stroke(SILICA_DARK, 2.6, 0.85),
    }),
    kit.glintLayer(shape.ellipse(30, 42, 6, 2.6)),
  ],
};

const SPINDLE = shape.path('M14 52 C26 38 58 36 80 46 C85 48 85 52 80 54 C58 64 26 64 14 52 Z');
const EUGLENA_FLAGELLUM = shape.path('M82 50 C88 42 90 34 86 22');
const FLAGELLUM_WAG = kit.motion(shape.GLYPH_MOTION.sway, 82, 50);
const EUGLENA_EYESPOT: shape.TraitGlyph = {
  traitId: 'euglena_eyespot',
  tiltDeg: -18,
  layers: [
    kit.haloLayer(kit.centreEllipse(44, 24), CHLORO_LIGHT, 0.35),
    kit.outlineLayer(EUGLENA_FLAGELLUM, 4, FLAGELLUM_WAG),
    kit.paint(shape.GLYPH_ROLE.signature, EUGLENA_FLAGELLUM, {
      stroke: kit.stroke(FLAGELLUM, 4, 0.5),
      motion: FLAGELLUM_WAG,
    }),
    kit.paint(shape.GLYPH_ROLE.signature, EUGLENA_FLAGELLUM, { stroke: kit.stroke(WHITE, 1.6), motion: FLAGELLUM_WAG }),
    ...kit.shadedBody({
      shape: SPINDLE,
      ramp: kit.GLYPH_RAMP.chloroplast,
      rim: kit.stroke(CHLORO_LIGHT, 1.4, 0.8),
      opacity: 0.85,
      motion: kit.BREATHE,
    }),
    kit.paint(
      shape.GLYPH_ROLE.detail,
      shape.path(
        shape.dotsPath(
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
        fill: kit.solid(CHLORO_DARK, 0.7),
        motion: kit.BREATHE,
      },
    ),
    kit.haloLayer(shape.circle(71, 50, 9), EYESPOT, 0.6),
    kit.paint(shape.GLYPH_ROLE.signature, shape.circle(71, 50, 4.2), {
      fill: kit.solid(EYESPOT),
      stroke: kit.stroke(EYESPOT_RIM, 1.2, 0.9),
    }),
    kit.glintLayer(shape.ellipse(28, 47, 6, 2.2), kit.BREATHE),
  ],
};

const DIATOM_SPINES = shape.path(
  shape.radialStrokesPath({
    ...kit.GLYPH_CENTRE_POINT,
    count: 8,
    innerRadius: 22,
    outerRadius: 40,
    leanTurns: 0,
    phaseTurns: 0.0625,
  }),
);
const DIATOM_SHELL: shape.TraitGlyph = {
  traitId: 'diatom_shell',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(kit.centreCircle(46), SILICA_BASE, 0.35),
    kit.outlineLayer(DIATOM_SPINES, 2, kit.SPIN),
    kit.paint(shape.GLYPH_ROLE.signature, DIATOM_SPINES, {
      stroke: kit.stroke(SILICA_LIGHT, 2, 0.95),
      motion: kit.SPIN,
    }),
    kit.paint(
      shape.GLYPH_ROLE.halo,
      shape.path(
        shape.dotRingPath({ ...kit.GLYPH_CENTRE_POINT, count: 8, ringRadius: 40, dotRadius: 3.6, phaseTurns: 0.0625 }),
      ),
      {
        fill: kit.solid(SILICA_LIGHT, 0.35),
        motion: kit.SPIN,
      },
    ),
    kit.paint(
      shape.GLYPH_ROLE.signature,
      shape.path(
        shape.dotRingPath({ ...kit.GLYPH_CENTRE_POINT, count: 8, ringRadius: 40, dotRadius: 1.8, phaseTurns: 0.0625 }),
      ),
      {
        fill: kit.solid(WHITE),
        motion: kit.SPIN,
      },
    ),
    ...kit.shadedBody({
      shape: kit.centreCircle(22),
      ramp: kit.GLYPH_RAMP.silica,
      rim: kit.stroke(SILICA_LIGHT, 1.6, 0.95),
    }),
    kit.paint(
      shape.GLYPH_ROLE.detail,
      shape.path(
        shape.radialStrokesPath({
          ...kit.GLYPH_CENTRE_POINT,
          count: 36,
          innerRadius: 7,
          outerRadius: 20,
          leanTurns: 0,
          phaseTurns: 0,
        }),
      ),
      {
        stroke: kit.stroke(SILICA_DARK, 0.8, 0.5),
        motion: kit.SPIN,
      },
    ),
    kit.paint(
      shape.GLYPH_ROLE.signature,
      shape.path('M38 44 C44 36 60 38 62 48 C60 58 44 62 38 54 C35 50 35 47 38 44 Z'),
      {
        fill: kit.solid(DIATOM_PLASTID_LIGHT, 0.75),
        stroke: kit.stroke(DIATOM_PLASTID_DARK, 1, 0.8),
      },
    ),
    kit.glintLayer(shape.ellipse(42, 39, 5, 2.6)),
  ],
};

const TRUMPET = shape.path(
  'M46 86 C44 70 40 56 28 36 C24 29 22 23 26 20 C40 16 60 16 74 20 C78 23 76 29 72 36 C60 56 56 70 54 86 Z',
);
const STALK_SWAY = kit.motion(shape.GLYPH_MOTION.sway, 50, 86);
const STENTOR_TRUMPET: shape.TraitGlyph = {
  traitId: 'stentor_trumpet',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(shape.circle(50, 48, 44), TOXIN_GLOW, 0.22),
    ...kit.shadedBody({
      shape: TRUMPET,
      ramp: kit.GLYPH_RAMP.vacuole,
      rim: kit.stroke(VAC_RIM, 1.4, 0.8),
      opacity: 0.85,
      motion: STALK_SWAY,
    }),
    kit.paint(
      shape.GLYPH_ROLE.detail,
      shape.path('M36 30 C42 50 46 66 49 84 M50 22 L50 84 M64 30 C58 50 54 66 51 84'),
      {
        stroke: kit.stroke(SILICA_DARK, 0.8, 0.35),
        motion: STALK_SWAY,
      },
    ),
    kit.paint(shape.GLYPH_ROLE.detail, shape.ellipse(50, 22, 20, 3.6), {
      fill: kit.solid(SILICA_DARK, 0.45),
      motion: STALK_SWAY,
    }),
    kit.paint(shape.GLYPH_ROLE.signature, shape.ellipse(50, 21, 25, 5.5), {
      stroke: kit.stroke(CILIA, 4, 0.9, '1 2.2'),
      motion: STALK_SWAY,
    }),
    kit.paint(
      shape.GLYPH_ROLE.signature,
      shape.path(
        shape.dotsPath(
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
        fill: kit.solid(ENVELOPE, 0.9),
        stroke: kit.stroke(SILICA_DARK, 0.6, 0.6),
        motion: STALK_SWAY,
      },
    ),
    kit.glintLayer(shape.ellipse(36, 28, 5, 2.4), STALK_SWAY),
  ],
};

/** The forms, in catalog order. */
export const FORM_TRAIT_GLYPHS: readonly shape.TraitGlyph[] = [
  AMOEBA_PSEUDOPODS,
  PARAMECIUM_CILIA,
  EUGLENA_EYESPOT,
  DIATOM_SHELL,
  STENTOR_TRUMPET,
];
