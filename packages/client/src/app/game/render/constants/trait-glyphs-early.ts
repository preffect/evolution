// The trait glyphs of rungs 1 and 2 (docs/visual-style/ui-type.md §7.1): the protocell and prokaryote traits, each
// drawn from its organelle vocabulary (visual-style/cells-and-organelles.md §4) in the 100 × 100 glyph box. Draw
// order is the array order: halo, pool, outline, body, detail, signature, glint.

import {
  GLYPH_MOTION,
  GLYPH_ROLE,
  circle,
  dotRingPath,
  dotsPath,
  ellipse,
  path,
  polygonPath,
  radialStrokesPath,
  type TraitGlyph,
} from '../svg-glyph';
import {
  CELL_WALL,
  CELL_WALL_LIGHT,
  CHLORO_DARK,
  CHLORO_LIGHT,
  FLAGELLUM,
  MITO_BASE,
  MITO_DARK,
  MITO_LIGHT,
  NUCLEOID_GLOW,
  NUCLEOID_STRAND,
  OUTLINE,
  PROTO_FILM,
  PROTO_FILM_LIGHT,
  PROTO_GRANULE,
  RIBOSOME,
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

// A plated wall: a hexagonal band whose corners stay sharp at 20 px, with a seam across the middle of each side.
const WALL_PLATES = path(polygonPath({ cx: 50, cy: 50, sides: 6, radius: 31, phaseTurns: 0 }));
const CELL_WALL_GLYPH: TraitGlyph = {
  traitId: 'cell_wall',
  tiltDeg: NO_TILT,
  layers: [
    haloLayer(circle(50, 50, 42), CELL_WALL, 0.4),
    poolLayer(path(polygonPath({ cx: 50, cy: 50, sides: 6, radius: 35, phaseTurns: 0 })), BREATHE),
    outlineLayer(WALL_PLATES, 8, BREATHE),
    ...shadedBody({
      shape: circle(50, 50, 22),
      ramp: GLYPH_RAMP.protocell,
      rim: stroke(PROTO_FILM, 1.2, 0.8),
      opacity: 0.75,
      motion: BREATHE,
    }),
    paint(signature, WALL_PLATES, { stroke: stroke(CELL_WALL, 8), motion: BREATHE }),
    paint(
      detail,
      path(
        radialStrokesPath({
          cx: 50,
          cy: 50,
          count: 6,
          innerRadius: 26,
          outerRadius: 34,
          leanTurns: 0,
          phaseTurns: 1 / 12,
        }),
      ),
      { stroke: stroke(OUTLINE, 1.2, 0.7), motion: BREATHE },
    ),
    paint(detail, path(polygonPath({ cx: 50, cy: 50, sides: 6, radius: 35.4, phaseTurns: 0 })), {
      stroke: stroke(CELL_WALL_LIGHT, 1, 0.8),
      motion: BREATHE,
    }),
    paint(GLYPH_ROLE.glint, path('M21 48 L34 25.5'), { stroke: stroke(WHITE, 2.2, 0.7), motion: BREATHE }),
    glintLayer(ellipse(40, 41, 5, 3), BREATHE),
  ],
};

// Studs stand proud of a smaller membrane, so the outline is a bumpy ring at 20 px.
const RIBOSOME_STUDS = path(dotRingPath({ cx: 50, cy: 50, count: 14, ringRadius: 31, dotRadius: 3.8, phaseTurns: 0 }));
const RIBOSOMES: TraitGlyph = {
  traitId: 'ribosomes',
  tiltDeg: NO_TILT,
  layers: [
    haloLayer(circle(50, 50, 42), RIBOSOME, 0.45),
    ...shadedBody({
      shape: circle(50, 50, 27),
      ramp: GLYPH_RAMP.protocell,
      rim: stroke(PROTO_FILM_LIGHT, 2, 0.9),
      opacity: 0.75,
      motion: BREATHE,
    }),
    paint(detail, path(dotRingPath({ cx: 50, cy: 50, count: 9, ringRadius: 15, dotRadius: 1.6, phaseTurns: 0.05 })), {
      fill: solid(RIBOSOME, 0.7),
      motion: BREATHE,
    }),
    outlineLayer(RIBOSOME_STUDS, 1, BREATHE),
    paint(signature, RIBOSOME_STUDS, { fill: solid(RIBOSOME), stroke: stroke(WHITE, 0.8, 0.6), motion: BREATHE }),
    glintLayer(ellipse(38, 37, 5, 3), BREATHE),
  ],
};

// A kidney bean: the notch in its lower edge is the outline tell that survives the list LOD.
const MITO_KIDNEY = path(
  'M20 50 C20 36 34 31 50 33 C66 31 80 36 80 50 C80 64 68 69 60 66 C56 54 44 54 40 66 C32 69 20 64 20 50 Z',
);
const MITO_CRISTAE = path('M33 40 Q39 50 33 60 M50 36 Q55 42 50 48 M67 40 Q73 50 67 60');
const MITOCHONDRION: TraitGlyph = {
  traitId: 'mitochondrion',
  tiltDeg: -24,
  layers: [
    haloLayer(ellipse(50, 50, 41, 28), MITO_BASE, 0.5),
    ...shadedBody({
      shape: MITO_KIDNEY,
      ramp: GLYPH_RAMP.mitochondrion,
      rim: stroke(MITO_LIGHT, 1.6, 0.9),
      motion: BEAT,
    }),
    paint(
      detail,
      path('M26 50 C26 40 37 37 50 38 C63 37 74 40 74 50 C74 58 67 62 62 60 C57 49 43 49 38 60 C33 62 26 58 26 50 Z'),
      { stroke: stroke(MITO_DARK, 1.2, 0.7), motion: BEAT },
    ),
    paint(signature, MITO_CRISTAE, { stroke: stroke(MITO_DARK, 5.5, 0.55), motion: BEAT }),
    paint(signature, MITO_CRISTAE, { stroke: stroke(MITO_LIGHT, 3.2, 0.9), motion: BEAT }),
    glintLayer(ellipse(36, 40, 6, 3), BEAT),
  ],
};

// Six grana sit on the lens's lit edge, half of each past it, so the outline is bumped at 20 px.
const CHLORO_GRANA = path(
  dotsPath(
    [
      [26, 36.4],
      [34, 32.5],
      [43, 30.5],
      [53, 30.1],
      [62, 31.4],
      [71, 34.7],
    ],
    6,
  ),
);
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
    outlineLayer(CHLORO_GRANA, 1.1, BREATHE),
    paint(signature, CHLORO_GRANA, {
      fill: solid(CHLORO_DARK),
      stroke: stroke(CHLORO_LIGHT, 1.1, 0.9),
      motion: BREATHE,
    }),
    glintLayer(ellipse(36, 45, 6, 2.6), BREATHE),
  ],
};

/** The protocell and prokaryote traits, in catalog order. */
export const EARLY_TRAIT_GLYPHS: readonly TraitGlyph[] = [
  NUCLEOID,
  SIMPLE_FLAGELLUM,
  CELL_WALL_GLYPH,
  RIBOSOMES,
  MITOCHONDRION,
  CHLOROPLAST,
];
