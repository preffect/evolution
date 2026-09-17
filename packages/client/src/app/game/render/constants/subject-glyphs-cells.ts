// The two cell kinds as the dish draws them (docs/visual-style/ui-type.md §7.2). A player cell is a smooth
// seat-lit blob wearing its seat-mark bead and its dashed self ring; a wild cell is the same body desaturated to
// steel, with no bead and no ring, crawling on a lobed amoeboid outline. Both tells are on the silhouette — a broken
// ring around one, a lobed edge on the other — so the pair separates at 20 px without relying on hue.

import * as shape from '../svg-glyph';
import { OUTLINE, SILICA_LIGHT, WHITE } from './colours';
import {
  GLYPH_PLAYER_SEAT,
  SUBJECT_ALPHA,
  SUBJECT_RAMP,
  SUBJECT_STROKE,
  bodyGlint,
  roundBodyLayers,
} from './subject-glyph-motifs';
import { lobedPath } from './subject-glyph-shapes';
import * as kit from './trait-glyph-layers';

/** The body a cell glyph is drawn at, the self ring outside it, and where the light and the seat bead sit. */
const CELL = {
  radius: 26,
  selfRingRadius: 34,
  /** `SELF_RING_DASH` 6 / 4 px (own-cell.ts), in the glyph's user units. */
  selfRingDash: '6 4',
  /** The bead sits where the glint does, at the top-left: the seat mark's anchor is under the glint (−135°). */
  beadTurns: -0.375,
  beadRadius: 4.2,
  beadHaloShare: 2.2,
  nucleusRadius: 8,
  nucleusRise: 3,
  haloShare: 1.6,
  /** The wild cell's crawl: six shallow lobes this deep, phased off the light so no lobe hides under the glint. */
  lobes: 6,
  lobeDepth: 2.8,
  lobePhaseTurns: 0.08,
  /** The wild rim light rides this far up and left of the body, which is where the condenser is. */
  rimLightOffset: -1.6,
} as const;

const NUCLEUS = { cx: 50 - CELL.nucleusRise, cy: 50 - CELL.nucleusRise } as const;
const [BEAD_X, BEAD_Y] = shape.polar([50, 50], CELL.radius, CELL.beadTurns);

const PLAYER_CELL: shape.SubjectGlyph = {
  entryId: 'cell_kind:player',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    ...roundBodyLayers(
      {
        cx: 50,
        cy: 50,
        radius: CELL.radius,
        ramp: SUBJECT_RAMP.player,
        rim: kit.stroke(GLYPH_PLAYER_SEAT.rim, SUBJECT_STROKE.rim),
        motion: kit.BREATHE,
      },
      CELL.haloShare,
    ),
    kit.paint(shape.GLYPH_ROLE.detail, shape.circle(NUCLEUS.cx, NUCLEUS.cy, CELL.nucleusRadius), {
      fill: kit.solid(GLYPH_PLAYER_SEAT.nucleus, SUBJECT_ALPHA.scatter),
      stroke: kit.stroke(GLYPH_PLAYER_SEAT.rim, SUBJECT_STROKE.hair),
      motion: kit.BREATHE,
    }),
    kit.paint(shape.GLYPH_ROLE.signature, kit.centreCircle(CELL.selfRingRadius), {
      stroke: kit.stroke(WHITE, SUBJECT_STROKE.fine, SUBJECT_ALPHA.scatter, CELL.selfRingDash),
      motion: kit.SPIN,
    }),
    kit.haloLayer(
      shape.circle(BEAD_X, BEAD_Y, CELL.beadRadius * CELL.beadHaloShare),
      GLYPH_PLAYER_SEAT.rim,
      SUBJECT_ALPHA.halo,
    ),
    kit.paint(shape.GLYPH_ROLE.signature, shape.circle(BEAD_X, BEAD_Y, CELL.beadRadius), {
      fill: kit.solid(WHITE),
      stroke: kit.stroke(OUTLINE, SUBJECT_STROKE.hair, SUBJECT_ALPHA.scatter),
    }),
  ],
};

const WILD_OUTLINE = shape.path(
  lobedPath({
    cx: 50,
    cy: 50,
    radius: CELL.radius,
    lobes: CELL.lobes,
    lobeDepth: CELL.lobeDepth,
    phaseTurns: CELL.lobePhaseTurns,
  }),
);

const WILD_CELL: shape.SubjectGlyph = {
  entryId: 'cell_kind:wild',
  tiltDeg: kit.GLYPH_NO_TILT,
  layers: [
    kit.haloLayer(kit.centreCircle(CELL.radius * CELL.haloShare), SUBJECT_RAMP.steel.light, SUBJECT_ALPHA.wash),
    ...kit.shadedBody({
      shape: WILD_OUTLINE,
      ramp: SUBJECT_RAMP.steel,
      rim: kit.stroke(SUBJECT_RAMP.steel.light, SUBJECT_STROKE.rim),
      motion: kit.BREATHE,
    }),
    kit.paint(shape.GLYPH_ROLE.detail, shape.circle(NUCLEUS.cx, NUCLEUS.cy, CELL.nucleusRadius), {
      fill: kit.solid(SILICA_LIGHT, SUBJECT_ALPHA.wash),
      stroke: kit.stroke(SILICA_LIGHT, SUBJECT_STROKE.hair, SUBJECT_ALPHA.scatter),
      motion: kit.BREATHE,
    }),
    {
      ...kit.paint(shape.GLYPH_ROLE.signature, WILD_OUTLINE, {
        stroke: kit.stroke(SILICA_LIGHT, SUBJECT_STROKE.fine, SUBJECT_ALPHA.scatter),
        motion: kit.BREATHE,
      }),
      offset: { x: CELL.rimLightOffset, y: CELL.rimLightOffset },
    },
    bodyGlint(50, 50, CELL.radius, kit.BREATHE),
  ],
};

export const CELL_KIND_SUBJECT_GLYPHS: readonly shape.SubjectGlyph[] = [PLAYER_CELL, WILD_CELL];
