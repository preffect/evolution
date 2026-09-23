// The mote atlas (docs/visual-style/principles-and-palette.md §2 food table, sheet 02 mote table): the algae circle, the
// oily detritus ellipse, the three bacterium rods and the DNA helix per tag, each with its core +
// edge + rim + glow + glint, at 4 px/wu plus a small variant at 1 px/wu for the far zoom.

import {
  ALGAE_RADIUS,
  BACTERIUM_RADIUS,
  BACTERIUM_VARIANT,
  DETRITUS_RADIUS,
  DNA_TAGS,
  type DnaTag,
} from '@evolution/shared';
import {
  ALGAE_GLOW,
  DETRITUS_ASPECT,
  DETRITUS_GLOW,
  FOOD_MOTE,
  FOOD_MOTE_EDGE,
  FOOD_MOTE_RIM,
  LIPID_BASE,
  LIPID_CENTRE,
  LIPID_LIGHT,
  LIPID_RIM,
  MOTE_ATLAS_PX_PER_WU,
  MOTE_BAKE,
  MOTE_SMALL_VARIANT_PX_PER_WU,
  WHITE,
} from '../constants';
import { bakeBacteriumRod, bakeRodGlint } from './bacterium-bake';
import { bakeFragmentSprite } from './fragment-bake';
import {
  createBodyCanvas,
  fillDisc,
  fillEllipse,
  fillRadial,
  paintGlint,
  paintGlow,
  strokeDisc,
  strokeEllipse,
  type BakeCanvas,
  type BakeCanvasFactory,
} from './texture-bake';

export const MOTE_SPRITE = {
  algae: 'algae',
  detritus: 'detritus',
  bacteriumPlain: 'bacterium_plain',
  bacteriumAerobic: 'bacterium_aerobic',
  bacteriumPhotosynthetic: 'bacterium_photosynthetic',
} as const;
export type MoteSpriteKey = (typeof MOTE_SPRITE)[keyof typeof MOTE_SPRITE];

/** The two variants of one sprite: full-size at `MOTE_ATLAS_PX_PER_WU`, small below `MOTE_SMALL_VARIANT_MAX_ZOOM`. */
export interface MoteVariants<Bake> {
  readonly full: Bake;
  readonly small: Bake;
}

export interface MoteAtlasBakes extends MoteVariants<Readonly<Record<MoteSpriteKey, BakeCanvas>>> {
  readonly fragments: Readonly<Record<DnaTag, BakeCanvas>>;
  /** The rod glint, drawn unrotated over a rod so the light stays top-left (bacterium-bake.ts). */
  readonly rodGlint: MoteVariants<BakeCanvas>;
  /** Sprite px per world unit, per variant, so a sprite scales to `wu × zoom`. */
  readonly fullPxPerWu: number;
  readonly smallPxPerWu: number;
}

/**
 * The colours each mote is baked in: the one table the bakes below paint from, and what a subject glyph that draws a
 * mote is held to (`subject-glyphs.spec.ts`).
 */
export const MOTE_PAINT = {
  algae: { body: FOOD_MOTE, edge: FOOD_MOTE_EDGE, rim: FOOD_MOTE_RIM, glint: WHITE },
  detritus: { body: LIPID_BASE, centre: LIPID_CENTRE, rim: LIPID_RIM, glint: LIPID_LIGHT },
} as const;

/** The algal mote: glow, body with its darker edge, rim, glint. */
function bakeAlgae(factory: BakeCanvasFactory, pxPerWu: number): BakeCanvas {
  const radius = ALGAE_RADIUS * pxPerWu;
  const { canvas, centre } = createBodyCanvas(factory, radius, ALGAE_GLOW.wide);
  const { context } = canvas;
  const disc = { x: centre, y: centre, radius };
  const paint = MOTE_PAINT.algae;
  paintGlow(context, disc, paint.body, ALGAE_GLOW);
  fillRadial(context, disc, [
    { offset: 0, colour: paint.body, alpha: 1 },
    { offset: 1 - MOTE_BAKE.edgeWidthShare, colour: paint.body, alpha: 1 },
    { offset: 1, colour: paint.edge, alpha: 1 },
  ]);
  strokeDisc(context, disc, { colour: paint.rim, alpha: 1, width: radius * MOTE_BAKE.rimWidthShare });
  paintGlint(context, disc, { colour: paint.glint, alpha: MOTE_BAKE.glintAlpha });
  return canvas;
}

/** The lipid mote: glow, oily ellipse with its darker centre, rim, a warm glint. */
function bakeDetritus(factory: BakeCanvasFactory, pxPerWu: number): BakeCanvas {
  const radiusX = DETRITUS_RADIUS * pxPerWu;
  const radiusY = radiusX * DETRITUS_ASPECT;
  const { canvas, centre } = createBodyCanvas(factory, radiusX, DETRITUS_GLOW.wide);
  const { context } = canvas;
  const disc = { x: centre, y: centre, radius: radiusX };
  const { body, centre: core, rim, glint } = MOTE_PAINT.detritus;
  paintGlow(context, disc, body, DETRITUS_GLOW);
  const ellipse = { x: centre, y: centre, radiusX, radiusY, rotation: 0 };
  fillEllipse(context, ellipse, { colour: body, alpha: 1 });
  fillDisc(context, { ...disc, radius: radiusX * MOTE_BAKE.lipidCentreShare }, { colour: core, alpha: 1 });
  strokeEllipse(context, ellipse, { colour: rim, alpha: 1, width: radiusX * MOTE_BAKE.rimWidthShare });
  paintGlint(context, disc, { colour: glint, alpha: MOTE_BAKE.glintAlpha });
  return canvas;
}

function bakeSet(factory: BakeCanvasFactory, pxPerWu: number): Record<MoteSpriteKey, BakeCanvas> {
  const rodRadius = BACTERIUM_RADIUS * pxPerWu;
  return {
    [MOTE_SPRITE.algae]: bakeAlgae(factory, pxPerWu),
    [MOTE_SPRITE.detritus]: bakeDetritus(factory, pxPerWu),
    [MOTE_SPRITE.bacteriumPlain]: bakeBacteriumRod(factory, BACTERIUM_VARIANT.plain, rodRadius),
    [MOTE_SPRITE.bacteriumAerobic]: bakeBacteriumRod(factory, BACTERIUM_VARIANT.aerobic, rodRadius),
    [MOTE_SPRITE.bacteriumPhotosynthetic]: bakeBacteriumRod(factory, BACTERIUM_VARIANT.photosynthetic, rodRadius),
  };
}

export function bakeMoteAtlas(factory: BakeCanvasFactory): MoteAtlasBakes {
  const fragments = {} as Record<DnaTag, BakeCanvas>;
  for (const tag of DNA_TAGS) fragments[tag] = bakeFragmentSprite(factory, tag, MOTE_ATLAS_PX_PER_WU);
  return {
    full: bakeSet(factory, MOTE_ATLAS_PX_PER_WU),
    small: bakeSet(factory, MOTE_SMALL_VARIANT_PX_PER_WU),
    fragments,
    rodGlint: {
      full: bakeRodGlint(factory, BACTERIUM_RADIUS * MOTE_ATLAS_PX_PER_WU),
      small: bakeRodGlint(factory, BACTERIUM_RADIUS * MOTE_SMALL_VARIANT_PX_PER_WU),
    },
    fullPxPerWu: MOTE_ATLAS_PX_PER_WU,
    smallPxPerWu: MOTE_SMALL_VARIANT_PX_PER_WU,
  };
}
