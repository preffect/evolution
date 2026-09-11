// The mote atlas (docs/VISUAL-STYLE.md §2 food table, sheet 02 mote table): the algae circle, the
// oily detritus ellipse, the three bacterium rods and the DNA helix per tag, each with its core +
// edge + rim + glow + glint, at 4 px/wu plus a small variant at 1 px/wu for the far zoom.

import { ALGAE_RADIUS, BACTERIUM_RADIUS, DETRITUS_RADIUS, DNA_TAGS, type DnaTag } from '@evolution/shared';
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
  MOTE_SMALL_VARIANT_PX_PER_WU,
  WHITE,
} from '../constants';
import { bakeBacteriumRod } from './bacterium-bake';
import { bakeFragmentSprite } from './fragment-bake';
import {
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

export interface MoteAtlas {
  /** Full-size sprites at `MOTE_ATLAS_PX_PER_WU`. */
  readonly full: Readonly<Record<MoteSpriteKey, BakeCanvas>>;
  /** The pre-rendered variants for zoom < `MOTE_SMALL_VARIANT_MAX_ZOOM`. */
  readonly small: Readonly<Record<MoteSpriteKey, BakeCanvas>>;
  readonly fragments: Readonly<Record<DnaTag, BakeCanvas>>;
  /** Sprite px per world unit, per variant, so a sprite scales to `wu × zoom`. */
  readonly fullPxPerWu: number;
  readonly smallPxPerWu: number;
}

const HALF = 0.5;
const SIDE_LENGTH = 2;
const GLINT_ALPHA = 0.7;
const EDGE_WIDTH_SHARE = 0.18;
const RIM_WIDTH_SHARE = 0.08;
const LIPID_CENTRE_SHARE = 0.45;

function bakeAlgae(factory: BakeCanvasFactory, pxPerWu: number): BakeCanvas {
  const radius = ALGAE_RADIUS * pxPerWu;
  const size = Math.ceil(radius * ALGAE_GLOW.wide * SIDE_LENGTH);
  const canvas = factory.create(size, size);
  const { context } = canvas;
  const disc = { x: size * HALF, y: size * HALF, radius };
  paintGlow(context, disc, FOOD_MOTE, ALGAE_GLOW);
  fillRadial(context, disc, [
    { offset: 0, colour: FOOD_MOTE, alpha: 1 },
    { offset: 1 - EDGE_WIDTH_SHARE, colour: FOOD_MOTE, alpha: 1 },
    { offset: 1, colour: FOOD_MOTE_EDGE, alpha: 1 },
  ]);
  strokeDisc(context, disc, { colour: FOOD_MOTE_RIM, alpha: 1, width: radius * RIM_WIDTH_SHARE });
  paintGlint(context, disc, { colour: WHITE, alpha: GLINT_ALPHA });
  return canvas;
}

function bakeDetritus(factory: BakeCanvasFactory, pxPerWu: number): BakeCanvas {
  const radiusX = DETRITUS_RADIUS * pxPerWu;
  const radiusY = radiusX * DETRITUS_ASPECT;
  const size = Math.ceil(radiusX * DETRITUS_GLOW.wide * SIDE_LENGTH);
  const canvas = factory.create(size, size);
  const { context } = canvas;
  const centre = size * HALF;
  paintGlow(context, { x: centre, y: centre, radius: radiusX }, LIPID_BASE, DETRITUS_GLOW);
  const ellipse = { x: centre, y: centre, radiusX, radiusY, rotation: 0 };
  fillEllipse(context, ellipse, { colour: LIPID_BASE, alpha: 1 });
  fillDisc(context, { x: centre, y: centre, radius: radiusX * LIPID_CENTRE_SHARE }, { colour: LIPID_CENTRE, alpha: 1 });
  strokeEllipse(context, ellipse, { colour: LIPID_RIM, alpha: 1, width: radiusX * RIM_WIDTH_SHARE });
  paintGlint(context, { x: centre, y: centre, radius: radiusX }, { colour: LIPID_LIGHT, alpha: GLINT_ALPHA });
  return canvas;
}

function bakeSet(factory: BakeCanvasFactory, pxPerWu: number): Record<MoteSpriteKey, BakeCanvas> {
  const rodRadius = BACTERIUM_RADIUS * pxPerWu;
  return {
    [MOTE_SPRITE.algae]: bakeAlgae(factory, pxPerWu),
    [MOTE_SPRITE.detritus]: bakeDetritus(factory, pxPerWu),
    [MOTE_SPRITE.bacteriumPlain]: bakeBacteriumRod(factory, 'plain', rodRadius),
    [MOTE_SPRITE.bacteriumAerobic]: bakeBacteriumRod(factory, 'aerobic', rodRadius),
    [MOTE_SPRITE.bacteriumPhotosynthetic]: bakeBacteriumRod(factory, 'photosynthetic', rodRadius),
  };
}

export function bakeMoteAtlas(factory: BakeCanvasFactory): MoteAtlas {
  const fragments = {} as Record<DnaTag, BakeCanvas>;
  for (const tag of DNA_TAGS) fragments[tag] = bakeFragmentSprite(factory, tag, MOTE_ATLAS_PX_PER_WU);
  return {
    full: bakeSet(factory, MOTE_ATLAS_PX_PER_WU),
    small: bakeSet(factory, MOTE_SMALL_VARIANT_PX_PER_WU),
    fragments,
    fullPxPerWu: MOTE_ATLAS_PX_PER_WU,
    smallPxPerWu: MOTE_SMALL_VARIANT_PX_PER_WU,
  };
}
