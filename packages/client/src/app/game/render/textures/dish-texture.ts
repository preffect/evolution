// The dish field (docs/VISUAL-STYLE.md §1–§2, sheet 02 field and zone tables): one render of the
// whole dish at a fixed resolution, blitted as a sprite under everything: the field colour, the
// condenser light pool from the top-left, three caustic arcs, the zone tints (shallows annulus,
// vent disc with its crust and seam, the gel patches with their strands) and the world outside the
// wall. The wall's crisp lines are Graphics at world scale (dish-layer.ts); everything here is soft.

import {
  DISH_RADIUS,
  GEL_PATCH_RADIUS,
  RADIANS_PER_FULL_TURN,
  SHALLOWS_WIDTH,
  VENT_RADIUS,
  type GelPatchView,
} from '@evolution/shared';
import {
  BG_FIELD,
  CAUSTIC_ALPHA,
  CAUSTIC_ARCS,
  FIELD_TEXTURE_PX,
  LIGHT_ACCENT,
  LIGHT_POOL_ALPHA,
  LIGHT_POOL_OFFSET_FRACTION,
  LIGHT_POOL_SIZE_WU,
  MIRE_STRANDS_PER_PATCH,
  MIRE_STRAND_ALPHA_MAX,
  MIRE_STRAND_ALPHA_MIN,
  OUTSIDE_DISH,
  OUTSIDE_DISH_ALPHA,
  VIGNETTE,
  VIGNETTE_ALPHA,
  VIGNETTE_RADIUS_FRACTION,
  VIGNETTE_TEXTURE_PX,
  WALL_GLASS_WU,
  ZONE_GEL,
  ZONE_SHALLOWS,
  ZONE_TINT_ALPHA,
  ZONE_VENT,
} from '../constants';
import { hexWithAlpha } from '../colour';
import { paintVent } from './vent-bake';
import {
  fillHalo,
  fillRadial,
  type BakeCanvas,
  type BakeCanvasFactory,
  type BakeContext2D,
  type DiscSpec,
} from './texture-bake';

export interface DishField {
  readonly canvas: BakeCanvas;
  /** World units per texture px, so the sprite is scaled to the dish. */
  readonly wuPerPx: number;
  /** The world extent the texture covers (a square of this half-size, centred on the origin). */
  readonly halfExtentWu: number;
}

const HALF = 0.5;
const SIDE_LENGTH = 2;
/** The texture reaches past the wall by this many glass widths so the outside shows around it. */
const OUTSIDE_MARGIN_GLASS = 3;
const CAUSTIC_WIDTH_WU = 40;
const CAUSTIC_SPACING_WU = 260;
/** The caustic arcs span 0.3 of a turn, starting 0.425 of a turn before the light. */
const CAUSTIC_SPAN_TURNS = 0.3;
const CAUSTIC_START_TURNS = -0.425;
const CAUSTIC_ANGLE_SPAN = RADIANS_PER_FULL_TURN * CAUSTIC_SPAN_TURNS;
const CAUSTIC_START_ANGLE = RADIANS_PER_FULL_TURN * CAUSTIC_START_TURNS;
const SHALLOWS_FEATHER_SHARE = 0.35;
const VENT_FEATHER_SHARE = 0.4;
const GEL_FEATHER_SHARE = 0.3;
const STRAND_LENGTH_SHARE = 0.7;
const STRAND_WIDTH_WU = 6;

/** A soft-edged disc: flat to `1 − feather` of the radius, then to 0. */
export function fillSoftDisc(
  context: BakeContext2D,
  disc: DiscSpec,
  paint: { colour: string; alpha: number; feather: number },
): void {
  fillRadial(context, disc, [
    { offset: 0, colour: paint.colour, alpha: paint.alpha },
    { offset: 1 - paint.feather, colour: paint.colour, alpha: paint.alpha },
    { offset: 1, colour: paint.colour, alpha: 0 },
  ]);
}

function paintLightPool(context: BakeContext2D, centre: number, pxPerWu: number): void {
  const x = centre - LIGHT_POOL_SIZE_WU.width * LIGHT_POOL_OFFSET_FRACTION * pxPerWu;
  const y = centre - LIGHT_POOL_SIZE_WU.height * LIGHT_POOL_OFFSET_FRACTION * pxPerWu;
  context.save();
  context.translate(x, y);
  context.scale(1, LIGHT_POOL_SIZE_WU.height / LIGHT_POOL_SIZE_WU.width);
  fillHalo(
    context,
    { x: 0, y: 0, radius: LIGHT_POOL_SIZE_WU.width * pxPerWu },
    { colour: LIGHT_ACCENT, alpha: LIGHT_POOL_ALPHA },
  );
  context.restore();
  context.strokeStyle = hexWithAlpha(LIGHT_ACCENT, CAUSTIC_ALPHA);
  context.lineWidth = CAUSTIC_WIDTH_WU * pxPerWu;
  context.lineCap = 'round';
  for (let arc = 0; arc < CAUSTIC_ARCS; arc += 1) {
    context.beginPath();
    context.arc(
      x,
      y,
      (arc + 1) * CAUSTIC_SPACING_WU * pxPerWu,
      CAUSTIC_START_ANGLE,
      CAUSTIC_START_ANGLE + CAUSTIC_ANGLE_SPAN,
    );
    context.stroke();
  }
}

/** The shallows annulus: a ring tint feathered toward the broth. */
function paintShallows(context: BakeContext2D, centre: number, pxPerWu: number): void {
  const inner = (DISH_RADIUS - SHALLOWS_WIDTH) / DISH_RADIUS;
  const feather = (1 - inner) * SHALLOWS_FEATHER_SHARE;
  fillRadial(context, { x: centre, y: centre, radius: DISH_RADIUS * pxPerWu }, [
    { offset: inner - feather, colour: ZONE_SHALLOWS, alpha: 0 },
    { offset: inner + feather, colour: ZONE_SHALLOWS, alpha: ZONE_TINT_ALPHA.shallows },
    { offset: 1, colour: ZONE_SHALLOWS, alpha: ZONE_TINT_ALPHA.shallows },
  ]);
}

function paintStrands(context: BakeContext2D, disc: DiscSpec, pxPerWu: number): void {
  context.lineWidth = STRAND_WIDTH_WU * pxPerWu;
  context.lineCap = 'round';
  for (let strand = 0; strand < MIRE_STRANDS_PER_PATCH; strand += 1) {
    const share = strand / MIRE_STRANDS_PER_PATCH;
    const angle = share * RADIANS_PER_FULL_TURN;
    const alpha = MIRE_STRAND_ALPHA_MIN + (MIRE_STRAND_ALPHA_MAX - MIRE_STRAND_ALPHA_MIN) * share;
    context.strokeStyle = hexWithAlpha(ZONE_GEL, alpha);
    const root = 1 - STRAND_LENGTH_SHARE;
    context.beginPath();
    context.moveTo(disc.x + Math.cos(angle) * disc.radius * root, disc.y + Math.sin(angle) * disc.radius * root);
    context.quadraticCurveTo(
      disc.x + Math.cos(angle + share) * disc.radius * HALF,
      disc.y + Math.sin(angle + share) * disc.radius * HALF,
      disc.x + Math.cos(angle) * disc.radius,
      disc.y + Math.sin(angle) * disc.radius,
    );
    context.stroke();
  }
}

/** Each gel patch: a feathered disc of the mire tint with radial strands. */
function paintGelPatches(
  context: BakeContext2D,
  centre: number,
  pxPerWu: number,
  patches: readonly GelPatchView[],
): void {
  for (const patch of patches) {
    const disc = {
      x: centre + patch.x * pxPerWu,
      y: centre + patch.y * pxPerWu,
      radius: (patch.radius || GEL_PATCH_RADIUS) * pxPerWu,
    };
    fillSoftDisc(context, disc, { colour: ZONE_GEL, alpha: ZONE_TINT_ALPHA.gel, feather: GEL_FEATHER_SHARE });
    paintStrands(context, disc, pxPerWu);
  }
}

/** Outside the wall: the stage, darkened (the square minus the dish disc). */
function paintOutside(context: BakeContext2D, centre: number, pxPerWu: number, size: number): void {
  context.save();
  context.beginPath();
  context.rect(0, 0, size, size);
  context.arc(centre, centre, (DISH_RADIUS + WALL_GLASS_WU) * pxPerWu, 0, RADIANS_PER_FULL_TURN);
  context.fillStyle = hexWithAlpha(OUTSIDE_DISH, OUTSIDE_DISH_ALPHA);
  context.fill();
  context.restore();
}

export function bakeDishField(factory: BakeCanvasFactory, patches: readonly GelPatchView[]): DishField {
  const halfExtentWu = DISH_RADIUS + WALL_GLASS_WU * OUTSIDE_MARGIN_GLASS;
  const size = FIELD_TEXTURE_PX;
  const pxPerWu = size / (halfExtentWu * SIDE_LENGTH);
  const canvas = factory.create(size, size);
  const { context } = canvas;
  const centre = size * HALF;
  context.fillStyle = BG_FIELD;
  context.fillRect(0, 0, size, size);
  paintLightPool(context, centre, pxPerWu);
  paintShallows(context, centre, pxPerWu);
  fillSoftDisc(
    context,
    { x: centre, y: centre, radius: VENT_RADIUS * pxPerWu },
    { colour: ZONE_VENT, alpha: ZONE_TINT_ALPHA.vent, feather: VENT_FEATHER_SHARE },
  );
  paintVent(context, centre, pxPerWu);
  paintGelPatches(context, centre, pxPerWu, patches);
  paintOutside(context, centre, pxPerWu, size);
  return { canvas, wuPerPx: 1 / pxPerWu, halfExtentWu };
}

/** The screen-space vignette: transparent to `VIGNETTE_RADIUS_FRACTION`, then to the vignette colour. */
export function bakeVignette(factory: BakeCanvasFactory): BakeCanvas {
  const canvas = factory.create(VIGNETTE_TEXTURE_PX, VIGNETTE_TEXTURE_PX);
  const centre = VIGNETTE_TEXTURE_PX * HALF;
  fillRadial(canvas.context, { x: centre, y: centre, radius: centre * Math.SQRT2 }, [
    { offset: 0, colour: VIGNETTE, alpha: 0 },
    { offset: VIGNETTE_RADIUS_FRACTION, colour: VIGNETTE, alpha: 0 },
    { offset: 1, colour: VIGNETTE, alpha: VIGNETTE_ALPHA },
  ]);
  return canvas;
}
