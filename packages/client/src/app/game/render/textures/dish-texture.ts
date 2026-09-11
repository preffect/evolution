// The dish field (docs/VISUAL-STYLE.md §1–§2, sheet 02 field and zone tables): one render of the
// whole dish at a fixed resolution, blitted as a sprite under everything: the field colour, the
// condenser light pool from the top-left, three caustic arcs, the zone tints (shallows annulus,
// vent disc with its crust and seam, the gel patches with their strands) and the stage outside
// the wall. The wall's crisp lines are Graphics at world scale (dish-layer.ts); everything here is
// soft. The zone noise clouds and the vent shimmer are deferred (see the PR).

import {
  COSMETIC_SUB_STREAM,
  DISH_RADIUS,
  RADIANS_PER_FULL_TURN,
  SHALLOWS_WIDTH,
  VENT_RADIUS,
  lerp,
  type GelPatchView,
  type RandomSource,
} from '@evolution/shared';
import { hexWithAlpha } from '../colour';
import {
  BG_FIELD,
  CAUSTIC_ALPHA,
  CAUSTIC_ARC,
  CAUSTIC_ARCS,
  CAUSTIC_SPACING_WU,
  CAUSTIC_WIDTH_WU,
  FIELD_OUTSIDE_MARGIN_GLASS,
  FIELD_TEXTURE_PX,
  LIGHT_ACCENT,
  LIGHT_POOL_ALPHA,
  LIGHT_POOL_MID,
  LIGHT_POOL_OFFSET_FRACTION,
  LIGHT_POOL_SIZE_WU,
  MIRE_STRAND,
  MIRE_STRANDS_PER_PATCH,
  MIRE_STRAND_ALPHA_MAX,
  MIRE_STRAND_ALPHA_MIN,
  OUTSIDE_DISH,
  OUTSIDE_DISH_ALPHA,
  SHALLOWS_FEATHER_SHARE,
  WALL_GLASS_WU,
  ZONE_GEL,
  ZONE_SHALLOWS,
  ZONE_TINT_ALPHA,
  ZONE_TINT_MID_ALPHA,
  ZONE_TINT_MID_STOP,
  ZONE_VENT,
} from '../constants';
import { DIAMETER_PER_RADIUS, HALF } from '../geometry';
import { fillRadial, type BakeCanvas, type BakeCanvasFactory, type BakeContext2D, type DiscSpec } from './texture-bake';
import { paintVent } from './vent-bake';

export interface DishField {
  readonly canvas: BakeCanvas;
  /** World units per texture px, so the sprite is scaled to the dish. */
  readonly wuPerPx: number;
  /** The world extent the texture covers: a square of this half-size, centred on the origin. */
  readonly halfExtentWu: number;
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

const VENT_TINT: ZoneTint = { colour: ZONE_VENT, alpha: ZONE_TINT_ALPHA.vent, midAlpha: ZONE_TINT_MID_ALPHA.vent };
const GEL_TINT: ZoneTint = { colour: ZONE_GEL, alpha: ZONE_TINT_ALPHA.gel, midAlpha: ZONE_TINT_MID_ALPHA.gel };

/** A zone disc's tint: full at the centre, the sheet's middle stop, clear at the zone radius. */
function paintZoneTint(context: BakeContext2D, disc: DiscSpec, tint: ZoneTint): void {
  fillRadial(context, disc, [
    { offset: 0, colour: tint.colour, alpha: tint.alpha },
    { offset: ZONE_TINT_MID_STOP, colour: tint.colour, alpha: tint.midAlpha },
    { offset: 1, colour: tint.colour, alpha: 0 },
  ]);
}

/** The condenser pool (sheet 02 `light-pool`) toward the top-left, and the caustic arcs around it. */
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
  context.strokeStyle = hexWithAlpha(LIGHT_ACCENT, CAUSTIC_ALPHA);
  context.lineWidth = CAUSTIC_WIDTH_WU * pxPerWu;
  context.lineCap = 'round';
  const start = RADIANS_PER_FULL_TURN * CAUSTIC_ARC.startTurns;
  const end = start + RADIANS_PER_FULL_TURN * CAUSTIC_ARC.spanTurns;
  for (let arc = 1; arc <= CAUSTIC_ARCS; arc += 1) {
    context.beginPath();
    context.arc(x, y, arc * CAUSTIC_SPACING_WU * pxPerWu, start, end);
    context.stroke();
  }
}

/** The shallows annulus: the tint from its inner edge to the wall, feathered toward the broth. */
function paintShallows(frame: FieldFrame): void {
  const inner = (DISH_RADIUS - SHALLOWS_WIDTH) / DISH_RADIUS;
  const feather = (1 - inner) * SHALLOWS_FEATHER_SHARE;
  fillRadial(frame.context, { x: frame.centre, y: frame.centre, radius: DISH_RADIUS * frame.pxPerWu }, [
    { offset: inner - feather, colour: ZONE_SHALLOWS, alpha: 0 },
    { offset: inner, colour: ZONE_SHALLOWS, alpha: ZONE_TINT_MID_ALPHA.shallows },
    { offset: inner + feather, colour: ZONE_SHALLOWS, alpha: ZONE_TINT_ALPHA.shallows },
    { offset: 1, colour: ZONE_SHALLOWS, alpha: ZONE_TINT_ALPHA.shallows },
  ]);
}

/** One strand: a rounded stroke from a seeded root outward, bent sideways, at a seeded alpha. */
function paintStrand(context: BakeContext2D, disc: DiscSpec, random: RandomSource): void {
  const angle = random.nextFloat() * RADIANS_PER_FULL_TURN;
  const root = random.nextFloat() * MIRE_STRAND.rootShareMax;
  const reach = Math.min(1, root + lerp(MIRE_STRAND.lengthShareMin, MIRE_STRAND.lengthShareMax, random.nextFloat()));
  const bend = (random.nextFloat() - HALF) * MIRE_STRAND.bendShare;
  context.strokeStyle = hexWithAlpha(ZONE_GEL, lerp(MIRE_STRAND_ALPHA_MIN, MIRE_STRAND_ALPHA_MAX, random.nextFloat()));
  const mid = (root + reach) * HALF;
  context.beginPath();
  context.moveTo(disc.x + Math.cos(angle) * disc.radius * root, disc.y + Math.sin(angle) * disc.radius * root);
  context.quadraticCurveTo(
    disc.x + Math.cos(angle + bend) * disc.radius * mid,
    disc.y + Math.sin(angle + bend) * disc.radius * mid,
    disc.x + Math.cos(angle) * disc.radius * reach,
    disc.y + Math.sin(angle) * disc.radius * reach,
  );
  context.stroke();
}

/** Each gel patch: the mire tint disc with its strands, placed from the dish sub-stream. */
function paintGelPatches(frame: FieldFrame, patches: readonly GelPatchView[], random: RandomSource): void {
  const { context, pxPerWu } = frame;
  context.lineWidth = MIRE_STRAND.widthWu * pxPerWu;
  context.lineCap = 'round';
  for (const patch of patches) {
    const disc = {
      x: frame.centre + patch.x * pxPerWu,
      y: frame.centre + patch.y * pxPerWu,
      radius: patch.radius * pxPerWu,
    };
    paintZoneTint(context, disc, GEL_TINT);
    for (let strand = 0; strand < MIRE_STRANDS_PER_PATCH; strand += 1) paintStrand(context, disc, random);
  }
}

/** Outside the wall: the stage, darkened (the square minus the dish disc, wall included). */
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

/** The field at `FIELD_TEXTURE_PX`, in sheet 02's draw order; strands are placed from the cosmetic stream. */
export function bakeDishField(
  factory: BakeCanvasFactory,
  patches: readonly GelPatchView[],
  cosmetic: RandomSource,
): DishField {
  const halfExtentWu = DISH_RADIUS + WALL_GLASS_WU * FIELD_OUTSIDE_MARGIN_GLASS;
  const sizePx = FIELD_TEXTURE_PX;
  const pxPerWu = sizePx / (halfExtentWu * DIAMETER_PER_RADIUS);
  const canvas = factory.create(sizePx, sizePx);
  const frame: FieldFrame = { context: canvas.context, centre: sizePx * HALF, pxPerWu, sizePx };
  frame.context.fillStyle = BG_FIELD;
  frame.context.fillRect(0, 0, sizePx, sizePx);
  paintLightPool(frame);
  paintShallows(frame);
  const ventDisc = { x: frame.centre, y: frame.centre, radius: VENT_RADIUS * pxPerWu };
  paintZoneTint(frame.context, ventDisc, VENT_TINT);
  paintVent(frame.context, frame.centre, pxPerWu);
  paintGelPatches(frame, patches, cosmetic.fork(COSMETIC_SUB_STREAM.dish));
  paintOutside(frame);
  return { canvas, wuPerPx: 1 / pxPerWu, halfExtentWu };
}
