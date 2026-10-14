// The dish field (docs/visual-style/principles-and-palette.md §1–§2, sheet 02 field, zone and dish-wall tables): one render
// of the whole dish at a fixed resolution, blitted as a sprite under everything: the field colour,
// the zone tints (shallows annulus, vent disc, the gel patches), the wall's inner shadow and the stage
// outside the wall. The wall's crisp lines are Graphics at world scale and the vent fissure is its own
// sprite over this one (dish-layer.ts); everything here is soft. The condenser light pool is not here: it
// is anchored to the view, not the world, so it is its own sprite the dish layer keeps fixed on screen
// (light-pool-bake.ts, rendering/budget.md §6.1).
//
// Resolution: `FIELD_TEXTURE_PX` over the dish is 0.33 px/wu, right for the tints at every zoom band.
// Anything with an edge is never baked into it (#223): the vent is its own sprite (vent-bake.ts), and the
// mire strands and stage scratches are placed here from the dish sub-stream but drawn by the dish layer
// as world-scale lines per zoom band (dish/dish-details.ts, rendering/budget.md §6).
// The zone noise clouds are deferred (see the PR).

import {
  COSMETIC_SUB_STREAM,
  DISH_RADIUS,
  RADIANS_PER_FULL_TURN,
  SHALLOWS_WIDTH,
  VENT_RADIUS,
  ZONE_ID,
  type GelPatchView,
  type RandomSource,
} from '@evolution/shared';
import { hexWithAlpha } from '../colour';
import {
  BG_FIELD,
  FIELD_OUTSIDE_MARGIN_GLASS,
  FIELD_TEXTURE_PX,
  OUTSIDE_DISH,
  OUTSIDE_DISH_ALPHA,
  SHALLOWS_FEATHER_SHARE,
  WALL_GLASS_WU,
  WALL_INNER_SHADOW,
  WALL_INNER_SHADOW_ALPHA,
  WALL_INNER_SHADOW_BLUR_WU,
  WALL_INNER_SHADOW_WU,
  ZONE_GEL,
  ZONE_SHALLOWS,
  ZONE_TINT_ALPHA,
  ZONE_TINT_MID_ALPHA,
  ZONE_TINT_MID_STOP,
  ZONE_VENT,
} from '../constants';
import { DIAMETER_PER_RADIUS, HALF } from '../geometry';
import { placeMireStrands, placeStageScratches, type DishDetailStroke } from './dish-field-details';
import { fillRadial, type BakeCanvas, type BakeCanvasFactory, type BakeContext2D, type DiscSpec } from './texture-bake';

export interface DishField {
  readonly canvas: BakeCanvas;
  /** The world extent the texture covers: a square of this half-size, centred on the origin. */
  readonly halfExtentWu: number;
  /** The mire strands, then the stage scratches, placed from the dish sub-stream; drawn by the dish layer. */
  readonly details: readonly DishDetailStroke[];
}

interface FieldFrame {
  readonly context: BakeContext2D;
  /** The dish centre on both axes, in px. */
  readonly centre: number;
  readonly pxPerWu: number;
  readonly sizePx: number;
}

const IS_ANTICLOCKWISE = true;

interface ZoneTint {
  readonly colour: string;
  readonly alpha: number;
  readonly midAlpha: number;
}

/**
 * The colour each tinted zone is painted in: what the dish draws, and what a subject glyph of that zone is held to
 * (`subject-glyphs.spec.ts`). The broth has no tint.
 */
export const ZONE_TINT_COLOUR = {
  [ZONE_ID.warmVent]: ZONE_VENT,
  [ZONE_ID.viscousGel]: ZONE_GEL,
  [ZONE_ID.sunlitShallows]: ZONE_SHALLOWS,
} as const;

const VENT_TINT: ZoneTint = {
  colour: ZONE_TINT_COLOUR[ZONE_ID.warmVent],
  alpha: ZONE_TINT_ALPHA.vent,
  midAlpha: ZONE_TINT_MID_ALPHA.vent,
};
const GEL_TINT: ZoneTint = {
  colour: ZONE_TINT_COLOUR[ZONE_ID.viscousGel],
  alpha: ZONE_TINT_ALPHA.gel,
  midAlpha: ZONE_TINT_MID_ALPHA.gel,
};

function dishDisc(frame: FieldFrame): DiscSpec {
  return { x: frame.centre, y: frame.centre, radius: DISH_RADIUS * frame.pxPerWu };
}

/** A zone disc's tint: full at the centre, the sheet's middle stop, clear at the zone radius. */
function paintZoneTint(context: BakeContext2D, disc: DiscSpec, tint: ZoneTint): void {
  fillRadial(context, disc, [
    { offset: 0, colour: tint.colour, alpha: tint.alpha },
    { offset: ZONE_TINT_MID_STOP, colour: tint.colour, alpha: tint.midAlpha },
    { offset: 1, colour: tint.colour, alpha: 0 },
  ]);
}

/** The shallows annulus: the tint from its inner edge to the wall, feathered toward the broth. */
function paintShallows(frame: FieldFrame): void {
  const inner = (DISH_RADIUS - SHALLOWS_WIDTH) / DISH_RADIUS;
  const feather = (1 - inner) * SHALLOWS_FEATHER_SHARE;
  const tint = ZONE_TINT_COLOUR[ZONE_ID.sunlitShallows];
  fillRadial(frame.context, dishDisc(frame), [
    { offset: inner - feather, colour: tint, alpha: 0 },
    { offset: inner, colour: tint, alpha: ZONE_TINT_MID_ALPHA.shallows },
    { offset: inner + feather, colour: tint, alpha: ZONE_TINT_ALPHA.shallows },
    { offset: 1, colour: tint, alpha: ZONE_TINT_ALPHA.shallows },
  ]);
}

/** Each gel patch: the mire tint disc (its strands are details, `placeMireStrands`). */
function paintGelPatches(frame: FieldFrame, patches: readonly GelPatchView[]): void {
  const { context, pxPerWu } = frame;
  for (const patch of patches) {
    const disc = {
      x: frame.centre + patch.x * pxPerWu,
      y: frame.centre + patch.y * pxPerWu,
      radius: patch.radius * pxPerWu,
    };
    paintZoneTint(context, disc, GEL_TINT);
  }
}

/** The wall's inner shadow (sheet 02 dish-wall table): a dark band just inside the wall, blurred on the broth side. */
function paintWallInnerShadow(frame: FieldFrame): void {
  const blur = WALL_INNER_SHADOW_BLUR_WU / DISH_RADIUS;
  const inner = 1 - WALL_INNER_SHADOW_WU / DISH_RADIUS;
  fillRadial(frame.context, dishDisc(frame), [
    { offset: inner - blur, colour: WALL_INNER_SHADOW, alpha: 0 },
    { offset: inner + blur, colour: WALL_INNER_SHADOW, alpha: WALL_INNER_SHADOW_ALPHA },
    { offset: 1, colour: WALL_INNER_SHADOW, alpha: WALL_INNER_SHADOW_ALPHA },
  ]);
}

/** Outside the wall: the stage, darkened (the square minus the dish disc, wall included); its scratches are details. */
function paintOutside(frame: FieldFrame): void {
  const { context } = frame;
  context.beginPath();
  context.rect(0, 0, frame.sizePx, frame.sizePx);
  context.arc(
    frame.centre,
    frame.centre,
    (DISH_RADIUS + WALL_GLASS_WU) * frame.pxPerWu,
    0,
    RADIANS_PER_FULL_TURN,
    IS_ANTICLOCKWISE,
  );
  context.fillStyle = hexWithAlpha(OUTSIDE_DISH, OUTSIDE_DISH_ALPHA);
  context.fill();
}

/**
 * The field at `FIELD_TEXTURE_PX`, in sheet 02's draw order, and its line details: the strands of every patch,
 * then the scratches, placed from the cosmetic stream's dish sub-stream in that order.
 */
export function bakeDishField(
  factory: BakeCanvasFactory,
  patches: readonly GelPatchView[],
  cosmetic: RandomSource,
  isVentTinted = true,
): DishField {
  const halfExtentWu = DISH_RADIUS + WALL_GLASS_WU * FIELD_OUTSIDE_MARGIN_GLASS;
  const sizePx = FIELD_TEXTURE_PX;
  const pxPerWu = sizePx / (halfExtentWu * DIAMETER_PER_RADIUS);
  const canvas = factory.create(sizePx, sizePx);
  const frame: FieldFrame = { context: canvas.context, centre: sizePx * HALF, pxPerWu, sizePx };
  frame.context.fillStyle = BG_FIELD;
  frame.context.fillRect(0, 0, sizePx, sizePx);
  paintShallows(frame);
  if (isVentTinted) {
    paintZoneTint(frame.context, { x: frame.centre, y: frame.centre, radius: VENT_RADIUS * pxPerWu }, VENT_TINT);
  }
  paintGelPatches(frame, patches);
  paintWallInnerShadow(frame);
  paintOutside(frame);
  const random = cosmetic.fork(COSMETIC_SUB_STREAM.dish);
  const details = [
    ...patches.flatMap((patch) => placeMireStrands(patch, ZONE_GEL, random)),
    ...placeStageScratches(halfExtentWu, random),
  ];
  return { canvas, halfExtentWu, details };
}
