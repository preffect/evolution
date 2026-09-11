// The dish field (docs/VISUAL-STYLE.md §1–§2, sheet 02 field, zone and dish-wall tables): one render
// of the whole dish at a fixed resolution, blitted as a sprite under everything: the field colour,
// the condenser light pool from the top-left with its caustic sweeps, the zone tints (shallows
// annulus, vent disc, the gel patches with their strands), the wall's inner shadow and the stage
// outside the wall with its scratches. The wall's crisp lines are Graphics at world scale and the
// vent fissure is its own sprite over this one (dish-layer.ts); everything here is soft.
//
// Resolution: `FIELD_TEXTURE_PX` over the dish is 0.33 px/wu, right for the tints and the pool.
// Anything with an edge (the vent, and later the strands) belongs in its own sprite at ≥ 1 px/wu
// (vent-bake.ts; the per-zoom-band textures of VISUAL-STYLE §8 are #223's), never in a bigger field.
// The zone noise clouds are deferred (see the PR).

import {
  COSMETIC_SUB_STREAM,
  DISH_RADIUS,
  RADIANS_PER_FULL_TURN,
  SHALLOWS_WIDTH,
  VENT_RADIUS,
  type GelPatchView,
  type RandomSource,
} from '@evolution/shared';
import { hexWithAlpha } from '../colour';
import {
  BG_FIELD,
  FIELD_OUTSIDE_MARGIN_GLASS,
  FIELD_TEXTURE_PX,
  LIGHT_ACCENT,
  LIGHT_POOL_ALPHA,
  LIGHT_POOL_MID,
  LIGHT_POOL_OFFSET_FRACTION,
  LIGHT_POOL_SIZE_WU,
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
import { paintCaustics, paintMireStrands, paintStageScratches } from './dish-field-details';
import { fillRadial, type BakeCanvas, type BakeCanvasFactory, type BakeContext2D, type DiscSpec } from './texture-bake';

export interface DishField {
  readonly canvas: BakeCanvas;
  /** The world extent the texture covers: a square of this half-size, centred on the origin. */
  readonly halfExtentWu: number;
}

interface FieldFrame {
  readonly context: BakeContext2D;
  /** The dish centre on both axes, in px. */
  readonly centre: number;
  readonly pxPerWu: number;
  readonly sizePx: number;
  readonly halfExtentWu: number;
}

const IS_ANTICLOCKWISE = true;

interface ZoneTint {
  readonly colour: string;
  readonly alpha: number;
  readonly midAlpha: number;
}

const VENT_TINT: ZoneTint = { colour: ZONE_VENT, alpha: ZONE_TINT_ALPHA.vent, midAlpha: ZONE_TINT_MID_ALPHA.vent };
const GEL_TINT: ZoneTint = { colour: ZONE_GEL, alpha: ZONE_TINT_ALPHA.gel, midAlpha: ZONE_TINT_MID_ALPHA.gel };

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

/** The condenser pool (sheet 02 `light-pool`) toward the top-left, and the caustic sweeps across it. */
function paintLightPool(frame: FieldFrame): void {
  const { context, pxPerWu } = frame;
  const x = frame.centre - LIGHT_POOL_SIZE_WU.width * LIGHT_POOL_OFFSET_FRACTION * pxPerWu;
  const y = frame.centre - LIGHT_POOL_SIZE_WU.height * LIGHT_POOL_OFFSET_FRACTION * pxPerWu;
  context.save();
  context.translate(x, y);
  context.scale(1, LIGHT_POOL_SIZE_WU.height / LIGHT_POOL_SIZE_WU.width);
  fillRadial(context, { x: 0, y: 0, radius: LIGHT_POOL_SIZE_WU.width * pxPerWu }, [
    { offset: 0, colour: LIGHT_ACCENT, alpha: LIGHT_POOL_ALPHA },
    { offset: LIGHT_POOL_MID.stop, colour: LIGHT_ACCENT, alpha: LIGHT_POOL_MID.alpha },
    { offset: 1, colour: LIGHT_ACCENT, alpha: 0 },
  ]);
  context.restore();
  paintCaustics(context, { x, y }, frame);
}

/** The shallows annulus: the tint from its inner edge to the wall, feathered toward the broth. */
function paintShallows(frame: FieldFrame): void {
  const inner = (DISH_RADIUS - SHALLOWS_WIDTH) / DISH_RADIUS;
  const feather = (1 - inner) * SHALLOWS_FEATHER_SHARE;
  fillRadial(frame.context, dishDisc(frame), [
    { offset: inner - feather, colour: ZONE_SHALLOWS, alpha: 0 },
    { offset: inner, colour: ZONE_SHALLOWS, alpha: ZONE_TINT_MID_ALPHA.shallows },
    { offset: inner + feather, colour: ZONE_SHALLOWS, alpha: ZONE_TINT_ALPHA.shallows },
    { offset: 1, colour: ZONE_SHALLOWS, alpha: ZONE_TINT_ALPHA.shallows },
  ]);
}

/** Each gel patch: the mire tint disc with its strands, placed from the dish sub-stream. */
function paintGelPatches(frame: FieldFrame, patches: readonly GelPatchView[], random: RandomSource): void {
  const { context, pxPerWu } = frame;
  for (const patch of patches) {
    const disc = {
      x: frame.centre + patch.x * pxPerWu,
      y: frame.centre + patch.y * pxPerWu,
      radius: patch.radius * pxPerWu,
    };
    paintZoneTint(context, disc, GEL_TINT);
    paintMireStrands(context, disc, { colour: ZONE_GEL, random, scale: frame });
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

/** Outside the wall: the stage, darkened (the square minus the dish disc, wall included), then its scratches. */
function paintOutside(frame: FieldFrame, random: RandomSource): void {
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
  paintStageScratches(context, frame, { random, scale: frame });
}

/** The field at `FIELD_TEXTURE_PX`, in sheet 02's draw order; strands and scratches are placed from the cosmetic stream. */
export function bakeDishField(
  factory: BakeCanvasFactory,
  patches: readonly GelPatchView[],
  cosmetic: RandomSource,
): DishField {
  const halfExtentWu = DISH_RADIUS + WALL_GLASS_WU * FIELD_OUTSIDE_MARGIN_GLASS;
  const sizePx = FIELD_TEXTURE_PX;
  const pxPerWu = sizePx / (halfExtentWu * DIAMETER_PER_RADIUS);
  const canvas = factory.create(sizePx, sizePx);
  const frame: FieldFrame = { context: canvas.context, centre: sizePx * HALF, pxPerWu, sizePx, halfExtentWu };
  const random = cosmetic.fork(COSMETIC_SUB_STREAM.dish);
  frame.context.fillStyle = BG_FIELD;
  frame.context.fillRect(0, 0, sizePx, sizePx);
  paintLightPool(frame);
  paintShallows(frame);
  paintZoneTint(frame.context, { x: frame.centre, y: frame.centre, radius: VENT_RADIUS * pxPerWu }, VENT_TINT);
  paintGelPatches(frame, patches, random);
  paintWallInnerShadow(frame);
  paintOutside(frame, random);
  return { canvas, halfExtentWu };
}
