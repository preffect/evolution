// The trait glyphs of rungs 1 and 2 (docs/visual-style/ui-type.md §7.1): the protocell and prokaryote traits, each
// drawn from its organelle vocabulary (visual-style/cells-and-organelles.md §4) in the 100 × 100 glyph box. Draw
// order is the array order: halo, pool, outline, body, detail, signature, glint.

import * as shape from '../svg-glyph';
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
import * as kit from './trait-glyph-layers';

const NUCLEOID_TANGLE = shape.path(
  'M30 52 C28 30 58 22 66 38 C74 54 56 72 42 64 C30 57 40 40 54 44 C66 48 64 62 52 60 M62 30 C78 38 76 64 58 70 C40 76 26 62 34 46',
);
const NUCLEOID: shape.TraitGlyph = {
  traitId: 'nucleoid',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(kit.centreCircle(36), NUCLEOID_GLOW, 0.45),
    ...kit.shadedBody({
      shape: kit.centreCircle(30),
      ramp: kit.GLYPH_RAMP.protocell,
      rim: kit.stroke(PROTO_FILM, 1, 0.5),
      opacity: 0.3,
    }),
    kit.paint(shape.GLYPH_ROLE.halo, NUCLEOID_TANGLE, { stroke: kit.stroke(NUCLEOID_GLOW, 7, 0.35), motion: kit.SPIN }),
    kit.paint(shape.GLYPH_ROLE.signature, NUCLEOID_TANGLE, {
      stroke: kit.stroke(NUCLEOID_STRAND, 2.6),
      motion: kit.SPIN,
    }),
    kit.paint(
      shape.GLYPH_ROLE.detail,
      shape.path(
        shape.dotsPath(
          [
            [42, 44],
            [58, 56],
            [54, 40],
          ],
          2.2,
        ),
      ),
      { fill: kit.solid(WHITE, 0.8), motion: kit.SPIN },
    ),
    kit.glintLayer(shape.ellipse(36, 34, 5, 3)),
  ],
};

const FLAGELLUM_BODY = shape.circle(38, 52, 17);
const FLAGELLUM_TAIL = shape.path('M54 52 C60 40 66 40 72 52 S84 64 90 52');
const TAIL_WAG = kit.motion(shape.GLYPH_MOTION.sway, 54, 52);
const SIMPLE_FLAGELLUM: shape.TraitGlyph = {
  traitId: 'simple_flagellum',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(shape.circle(46, 52, 30), FLAGELLUM, 0.4),
    kit.outlineLayer(FLAGELLUM_TAIL, 4.5, TAIL_WAG),
    kit.paint(shape.GLYPH_ROLE.signature, FLAGELLUM_TAIL, {
      stroke: kit.stroke(FLAGELLUM, 4.5, 0.55),
      motion: TAIL_WAG,
    }),
    kit.paint(shape.GLYPH_ROLE.signature, FLAGELLUM_TAIL, { stroke: kit.stroke(WHITE, 1.8), motion: TAIL_WAG }),
    ...kit.shadedBody({
      shape: FLAGELLUM_BODY,
      ramp: kit.GLYPH_RAMP.protocell,
      rim: kit.stroke(PROTO_FILM_LIGHT, 1.5, 0.8),
    }),
    kit.paint(
      shape.GLYPH_ROLE.detail,
      shape.path(
        shape.dotsPath(
          [
            [33, 56],
            [42, 48],
            [41, 59],
          ],
          2,
        ),
      ),
      { fill: kit.solid(PROTO_GRANULE, 0.7) },
    ),
    kit.glintLayer(shape.ellipse(32, 45, 5, 3)),
  ],
};

// A plated wall: a hexagonal band whose corners stay sharp at 20 px, with a seam across the middle of each side.
const WALL_PLATES = shape.path(shape.polygonPath({ ...kit.GLYPH_CENTRE_POINT, sides: 6, radius: 31, phaseTurns: 0 }));
const CELL_WALL_GLYPH: shape.TraitGlyph = {
  traitId: 'cell_wall',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(kit.centreCircle(42), CELL_WALL, 0.4),
    kit.poolLayer(
      shape.path(shape.polygonPath({ ...kit.GLYPH_CENTRE_POINT, sides: 6, radius: 35, phaseTurns: 0 })),
      kit.BREATHE,
    ),
    kit.outlineLayer(WALL_PLATES, 8, kit.BREATHE),
    ...kit.shadedBody({
      shape: kit.centreCircle(22),
      ramp: kit.GLYPH_RAMP.protocell,
      rim: kit.stroke(PROTO_FILM, 1.2, 0.8),
      opacity: 0.75,
      motion: kit.BREATHE,
    }),
    kit.paint(shape.GLYPH_ROLE.signature, WALL_PLATES, { stroke: kit.stroke(CELL_WALL, 8), motion: kit.BREATHE }),
    kit.paint(
      shape.GLYPH_ROLE.detail,
      shape.path(
        shape.radialStrokesPath({
          ...kit.GLYPH_CENTRE_POINT,
          count: 6,
          innerRadius: 26,
          outerRadius: 34,
          leanTurns: 0,
          phaseTurns: 1 / 12,
        }),
      ),
      { stroke: kit.stroke(OUTLINE, 1.2, 0.7), motion: kit.BREATHE },
    ),
    kit.paint(
      shape.GLYPH_ROLE.detail,
      shape.path(shape.polygonPath({ ...kit.GLYPH_CENTRE_POINT, sides: 6, radius: 35.4, phaseTurns: 0 })),
      {
        stroke: kit.stroke(CELL_WALL_LIGHT, 1, 0.8),
        motion: kit.BREATHE,
      },
    ),
    kit.paint(shape.GLYPH_ROLE.glint, shape.path('M21 48 L34 25.5'), {
      stroke: kit.stroke(WHITE, 2.2, 0.7),
      motion: kit.BREATHE,
    }),
    kit.glintLayer(shape.ellipse(40, 41, 5, 3), kit.BREATHE),
  ],
};

// Studs stand proud of a smaller membrane, so the outline is a bumpy ring at 20 px.
const RIBOSOME_STUDS = shape.path(
  shape.dotRingPath({ ...kit.GLYPH_CENTRE_POINT, count: 14, ringRadius: 31, dotRadius: 3.8, phaseTurns: 0 }),
);
const RIBOSOMES: shape.TraitGlyph = {
  traitId: 'ribosomes',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(kit.centreCircle(42), RIBOSOME, 0.45),
    ...kit.shadedBody({
      shape: kit.centreCircle(27),
      ramp: kit.GLYPH_RAMP.protocell,
      rim: kit.stroke(PROTO_FILM_LIGHT, 2, 0.9),
      opacity: 0.75,
      motion: kit.BREATHE,
    }),
    kit.paint(
      shape.GLYPH_ROLE.detail,
      shape.path(
        shape.dotRingPath({ ...kit.GLYPH_CENTRE_POINT, count: 9, ringRadius: 15, dotRadius: 1.6, phaseTurns: 0.05 }),
      ),
      {
        fill: kit.solid(RIBOSOME, 0.7),
        motion: kit.BREATHE,
      },
    ),
    kit.outlineLayer(RIBOSOME_STUDS, 1, kit.BREATHE),
    kit.paint(shape.GLYPH_ROLE.signature, RIBOSOME_STUDS, {
      fill: kit.solid(RIBOSOME),
      stroke: kit.stroke(WHITE, 0.8, 0.6),
      motion: kit.BREATHE,
    }),
    kit.glintLayer(shape.ellipse(38, 37, 5, 3), kit.BREATHE),
  ],
};

// A kidney bean: the notch in its lower edge is the outline tell that survives the list LOD.
const MITO_KIDNEY = shape.path(
  'M20 50 C20 36 34 31 50 33 C66 31 80 36 80 50 C80 64 68 69 60 66 C56 54 44 54 40 66 C32 69 20 64 20 50 Z',
);
const MITO_CRISTAE = shape.path('M33 40 Q39 50 33 60 M50 36 Q55 42 50 48 M67 40 Q73 50 67 60');
const MITOCHONDRION: shape.TraitGlyph = {
  traitId: 'mitochondrion',
  tiltDeg: -24,
  layers: [
    kit.haloLayer(kit.centreEllipse(41, 28), MITO_BASE, 0.5),
    ...kit.shadedBody({
      shape: MITO_KIDNEY,
      ramp: kit.GLYPH_RAMP.mitochondrion,
      rim: kit.stroke(MITO_LIGHT, 1.6, 0.9),
      motion: kit.BEAT,
    }),
    kit.paint(
      shape.GLYPH_ROLE.detail,
      shape.path(
        'M26 50 C26 40 37 37 50 38 C63 37 74 40 74 50 C74 58 67 62 62 60 C57 49 43 49 38 60 C33 62 26 58 26 50 Z',
      ),
      { stroke: kit.stroke(MITO_DARK, 1.2, 0.7), motion: kit.BEAT },
    ),
    kit.paint(shape.GLYPH_ROLE.signature, MITO_CRISTAE, { stroke: kit.stroke(MITO_DARK, 5.5, 0.55), motion: kit.BEAT }),
    kit.paint(shape.GLYPH_ROLE.signature, MITO_CRISTAE, { stroke: kit.stroke(MITO_LIGHT, 3.2, 0.9), motion: kit.BEAT }),
    kit.glintLayer(shape.ellipse(36, 40, 6, 3), kit.BEAT),
  ],
};

// Six grana sit on the lens's lit edge, half of each past it, so the outline is bumped at 20 px.
const CHLORO_GRANA = shape.path(
  shape.dotsPath(
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
const CHLOROPLAST: shape.TraitGlyph = {
  traitId: 'chloroplast',
  tiltDeg: 16,
  layers: [
    kit.haloLayer(kit.centreEllipse(42, 29), CHLORO_LIGHT, 0.45),
    ...kit.shadedBody({
      shape: kit.centreEllipse(32, 19),
      ramp: kit.GLYPH_RAMP.chloroplast,
      rim: kit.stroke(CHLORO_LIGHT, 1.6, 0.9),
      motion: kit.BREATHE,
    }),
    kit.paint(shape.GLYPH_ROLE.detail, shape.path('M24 52 C40 46 60 46 76 52 M26 58 C42 53 58 53 74 58'), {
      stroke: kit.stroke(CHLORO_LIGHT, 1, 0.45),
      motion: kit.BREATHE,
    }),
    kit.outlineLayer(CHLORO_GRANA, 1.1, kit.BREATHE),
    kit.paint(shape.GLYPH_ROLE.signature, CHLORO_GRANA, {
      fill: kit.solid(CHLORO_DARK),
      stroke: kit.stroke(CHLORO_LIGHT, 1.1, 0.9),
      motion: kit.BREATHE,
    }),
    kit.glintLayer(shape.ellipse(36, 45, 6, 2.6), kit.BREATHE),
  ],
};

/** The protocell and prokaryote traits, in catalog order. */
export const EARLY_TRAIT_GLYPHS: readonly shape.TraitGlyph[] = [
  NUCLEOID,
  SIMPLE_FLAGELLUM,
  CELL_WALL_GLYPH,
  RIBOSOMES,
  MITOCHONDRION,
  CHLOROPLAST,
];
