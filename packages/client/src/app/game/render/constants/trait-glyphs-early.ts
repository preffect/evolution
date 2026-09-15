// The trait glyphs of rungs 1 to 3 (docs/visual-style/ui-type.md §7.1): the protocell, prokaryote and endosymbiosis
// traits, each drawn from its organelle vocabulary (visual-style/cells-and-organelles.md §4) in
// the 100 × 100 glyph box. Draw order is the array order: halo, pool, outline, body, detail, signature, glint.

import { GLYPH_MOTION, GLYPH_ROLE, circle, dotRingPath, dotsPath, ellipse, path, type TraitGlyph } from '../svg-glyph';
import {
  BLACK,
  CELL_WALL,
  CELL_WALL_LIGHT,
  CHLORO_DARK,
  CHLORO_LIGHT,
  ENVELOPE,
  FLAGELLUM,
  MITO_BASE,
  MITO_DARK,
  MITO_LIGHT,
  NUCLEOID_GLOW,
  NUCLEOID_STRAND,
  PORE,
  PROTO_FILM,
  PROTO_FILM_LIGHT,
  PROTO_GRANULE,
  RIBOSOME,
  SILICA_DARK,
  WHITE,
} from './colours';
import {
  BEAT,
  BREATHE,
  GLYPH_RAMP,
  SPIN,
  glintLayer,
  haloLayer,
  motion,
  outlineLayer,
  paint,
  poolLayer,
  shadedBody,
  solid,
  stroke,
} from './trait-glyph-layers';

const { detail, signature } = GLYPH_ROLE;
const NO_TILT = 0;

const NUCLEOID_TANGLE = path(
  'M30 52 C28 30 58 22 66 38 C74 54 56 72 42 64 C30 57 40 40 54 44 C66 48 64 62 52 60 M62 30 C78 38 76 64 58 70 C40 76 26 62 34 46',
);
const NUCLEOID: TraitGlyph = {
  traitId: 'nucleoid',
  tiltDeg: NO_TILT,
  layers: [
    haloLayer(circle(50, 50, 36), NUCLEOID_GLOW, 0.45),
    ...shadedBody({
      shape: circle(50, 50, 30),
      ramp: GLYPH_RAMP.protocell,
      rim: stroke(PROTO_FILM, 1, 0.5),
      opacity: 0.3,
    }),
    paint(GLYPH_ROLE.halo, NUCLEOID_TANGLE, { stroke: stroke(NUCLEOID_GLOW, 7, 0.35), motion: SPIN }),
    paint(signature, NUCLEOID_TANGLE, { stroke: stroke(NUCLEOID_STRAND, 2.6), motion: SPIN }),
    paint(
      detail,
      path(
        dotsPath(
          [
            [42, 44],
            [58, 56],
            [54, 40],
          ],
          2.2,
        ),
      ),
      { fill: solid(WHITE, 0.8), motion: SPIN },
    ),
    glintLayer(ellipse(36, 34, 5, 3)),
  ],
};

const FLAGELLUM_BODY = circle(38, 52, 17);
const FLAGELLUM_TAIL = path('M54 52 C60 40 66 40 72 52 S84 64 90 52');
const TAIL_WAG = motion(GLYPH_MOTION.sway, 54, 52);
const SIMPLE_FLAGELLUM: TraitGlyph = {
  traitId: 'simple_flagellum',
  tiltDeg: NO_TILT,
  layers: [
    haloLayer(circle(46, 52, 30), FLAGELLUM, 0.4),
    outlineLayer(FLAGELLUM_TAIL, 4.5, TAIL_WAG),
    paint(signature, FLAGELLUM_TAIL, { stroke: stroke(FLAGELLUM, 4.5, 0.55), motion: TAIL_WAG }),
    paint(signature, FLAGELLUM_TAIL, { stroke: stroke(WHITE, 1.8), motion: TAIL_WAG }),
    ...shadedBody({ shape: FLAGELLUM_BODY, ramp: GLYPH_RAMP.protocell, rim: stroke(PROTO_FILM_LIGHT, 1.5, 0.8) }),
    paint(
      detail,
      path(
        dotsPath(
          [
            [33, 56],
            [42, 48],
            [41, 59],
          ],
          2,
        ),
      ),
      { fill: solid(PROTO_GRANULE, 0.7) },
    ),
    glintLayer(ellipse(32, 45, 5, 3)),
  ],
};

const CELL_WALL_GLYPH: TraitGlyph = {
  traitId: 'cell_wall',
  tiltDeg: NO_TILT,
  layers: [
    haloLayer(circle(50, 50, 40), CELL_WALL, 0.4),
    poolLayer(circle(50, 50, 34), BREATHE),
    outlineLayer(circle(50, 50, 31), 7, BREATHE),
    ...shadedBody({
      shape: circle(50, 50, 24),
      ramp: GLYPH_RAMP.protocell,
      rim: stroke(PROTO_FILM, 1.2, 0.8),
      opacity: 0.75,
      motion: BREATHE,
    }),
    paint(signature, circle(50, 50, 31), { stroke: stroke(CELL_WALL, 7, 1, '11 2.4'), motion: BREATHE }),
    paint(detail, circle(50, 50, 34.8), { stroke: stroke(CELL_WALL_LIGHT, 1.1, 0.8), motion: BREATHE }),
    paint(detail, circle(50, 50, 27.2), { stroke: stroke(CELL_WALL_LIGHT, 0.8, 0.5), motion: BREATHE }),
    paint(GLYPH_ROLE.glint, path('M19.5 44.6 A31 31 0 0 1 44.6 19.5'), {
      stroke: stroke(WHITE, 2.2, 0.7),
      motion: BREATHE,
    }),
    glintLayer(ellipse(42, 41, 5, 3), BREATHE),
  ],
};

const RIBOSOME_RING = path(dotRingPath({ cx: 50, cy: 50, count: 18, ringRadius: 26, dotRadius: 2.4, phaseTurns: 0 }));
const RIBOSOMES: TraitGlyph = {
  traitId: 'ribosomes',
  tiltDeg: NO_TILT,
  layers: [
    haloLayer(circle(50, 50, 40), RIBOSOME, 0.3),
    ...shadedBody({
      shape: circle(50, 50, 32),
      ramp: GLYPH_RAMP.protocell,
      rim: stroke(PROTO_FILM, 2.4, 0.9),
      opacity: 0.45,
      motion: BREATHE,
    }),
    paint(detail, path(dotRingPath({ cx: 50, cy: 50, count: 11, ringRadius: 17, dotRadius: 1.6, phaseTurns: 0.05 })), {
      fill: solid(RIBOSOME, 0.6),
      motion: BREATHE,
    }),
    paint(GLYPH_ROLE.halo, RIBOSOME_RING, { stroke: stroke(RIBOSOME, 2.5, 0.3), motion: BREATHE }),
    paint(signature, RIBOSOME_RING, { fill: solid(RIBOSOME), motion: BREATHE }),
    glintLayer(ellipse(36, 34, 5, 3), BREATHE),
  ],
};

const MITO_CRISTAE = path('M34 39 Q41 50 34 61 M50 35 Q57 50 50 65 M66 39 Q73 50 66 61');
const MITOCHONDRION: TraitGlyph = {
  traitId: 'mitochondrion',
  tiltDeg: -24,
  layers: [
    haloLayer(ellipse(50, 50, 41, 28), MITO_BASE, 0.5),
    ...shadedBody({
      shape: ellipse(50, 50, 31, 18),
      ramp: GLYPH_RAMP.mitochondrion,
      rim: stroke(MITO_LIGHT, 1.6, 0.9),
      motion: BEAT,
    }),
    paint(detail, ellipse(50, 50, 26, 13.5), { stroke: stroke(MITO_DARK, 1.2, 0.7), motion: BEAT }),
    paint(signature, MITO_CRISTAE, { stroke: stroke(MITO_DARK, 5.5, 0.55), motion: BEAT }),
    paint(signature, MITO_CRISTAE, { stroke: stroke(MITO_LIGHT, 3.2, 0.9), motion: BEAT }),
    glintLayer(ellipse(36, 40, 6, 3), BEAT),
  ],
};

const CHLOROPLAST: TraitGlyph = {
  traitId: 'chloroplast',
  tiltDeg: 16,
  layers: [
    haloLayer(ellipse(50, 50, 42, 29), CHLORO_LIGHT, 0.45),
    ...shadedBody({
      shape: ellipse(50, 50, 32, 19),
      ramp: GLYPH_RAMP.chloroplast,
      rim: stroke(CHLORO_LIGHT, 1.6, 0.9),
      motion: BREATHE,
    }),
    paint(detail, path('M24 52 C40 46 60 46 76 52 M26 58 C42 53 58 53 74 58'), {
      stroke: stroke(CHLORO_LIGHT, 1, 0.45),
      motion: BREATHE,
    }),
    paint(
      signature,
      path(
        dotsPath(
          [
            [28, 48],
            [37, 42],
            [46, 39],
            [55, 39],
            [64, 42],
            [73, 48],
          ],
          4.2,
        ),
      ),
      {
        fill: solid(CHLORO_DARK),
        stroke: stroke(CHLORO_LIGHT, 1.1, 0.9),
        motion: BREATHE,
      },
    ),
    glintLayer(ellipse(38, 37, 6, 2.6), BREATHE),
  ],
};

// The envelope's dash is a sixteenth of each ring's circumference less one pore gap; the pore dots sit in the gaps.
const NUCLEAR_ENVELOPE: TraitGlyph = {
  traitId: 'nuclear_envelope',
  tiltDeg: NO_TILT,
  layers: [
    haloLayer(circle(50, 50, 42), NUCLEOID_GLOW, 0.4),
    outlineLayer(circle(50, 50, 31), 2),
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
    paint(signature, circle(50, 50, 27), { stroke: stroke(ENVELOPE, 2, 1, '8.6 2'), motion: SPIN }),
    paint(signature, circle(50, 50, 31), { stroke: stroke(ENVELOPE, 2, 0.85, '10.17 2'), motion: SPIN }),
    paint(
      signature,
      path(dotRingPath({ cx: 50, cy: 50, count: 16, ringRadius: 29, dotRadius: 1.5, phaseTurns: 0.057 })),
      { fill: solid(PORE), motion: SPIN },
    ),
    glintLayer(ellipse(42, 42, 5, 3)),
  ],
};

/** The protocell, prokaryote and endosymbiosis traits, in catalog order. */
export const EARLY_TRAIT_GLYPHS: readonly TraitGlyph[] = [
  NUCLEOID,
  SIMPLE_FLAGELLUM,
  CELL_WALL_GLYPH,
  RIBOSOMES,
  MITOCHONDRION,
  CHLOROPLAST,
  NUCLEAR_ENVELOPE,
];
