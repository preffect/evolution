// The line details of the field and the light pool (sheet 02). The three caustic sweeps are painted into the
// pool bake (light-pool-bake.ts, 0.52 × 0.67 texel/wu), so a stroke thinner than `FIELD_MIN_STROKE_TEXELS` is
// widened to that and read by its alpha alone. The mire strands over each gel patch and the stage scratches
// outside the wall are only placed here, as world-space strokes from the dish sub-stream: the dish layer draws
// them at world scale per zoom band (dish/dish-details.ts, #223), because in the 0.33 px/wu field they blurred.

import { DISH_RADIUS, RADIANS_PER_FULL_TURN, lerp, type GelPatchView, type RandomSource } from '@evolution/shared';
import { hexWithAlpha } from '../colour';
import {
  CAUSTIC_ALPHA,
  CAUSTIC_SWEEPS,
  FIELD_MIN_STROKE_TEXELS,
  LIGHT_ACCENT,
  MIRE_STRAND,
  MIRE_STRANDS_PER_PATCH,
  MIRE_STRAND_ALPHA_MAX,
  MIRE_STRAND_ALPHA_MIN,
  STAGE_SCRATCH,
  STAGE_SCRATCHES,
  WALL_GLASS_WU,
} from '../constants';
import { HALF } from '../geometry';
import type { BakeContext2D } from './texture-bake';

/** A point in the field texture, in px. */
export interface FieldPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * The texture's scale: wu to px on x (stroke widths follow it), and on y when the bake maps the axes
 * apart (the light pool, rendering/budget.md §6.1); `pxPerWuY` defaults to `pxPerWu`.
 */
export interface FieldScale {
  readonly pxPerWu: number;
  readonly pxPerWuY?: number;
}

/** A stroke width in px for `widthWu`, never thinner than the texel floor. */
export function fieldStrokePx(widthWu: number, scale: FieldScale): number {
  return Math.max(widthWu * scale.pxPerWu, FIELD_MIN_STROKE_TEXELS);
}

/** The caustics: `CAUSTIC_SWEEPS` as open cubic curves around `pool`, round-capped, at `CAUSTIC_ALPHA`. */
export function paintCaustics(context: BakeContext2D, pool: FieldPoint, scale: FieldScale): void {
  const pxPerWuY = scale.pxPerWuY ?? scale.pxPerWu;
  context.strokeStyle = hexWithAlpha(LIGHT_ACCENT, CAUSTIC_ALPHA);
  context.lineCap = 'round';
  for (const sweep of CAUSTIC_SWEEPS) {
    const toField = (point: FieldPoint) => ({
      x: pool.x + point.x * scale.pxPerWu,
      y: pool.y + point.y * pxPerWuY,
    });
    const [start, control1, control2, end] = [sweep.start, sweep.control1, sweep.control2, sweep.end].map(toField);
    context.lineWidth = fieldStrokePx(sweep.widthWu, scale);
    context.beginPath();
    context.moveTo(start!.x, start!.y);
    context.bezierCurveTo(control1!.x, control1!.y, control2!.x, control2!.y, end!.x, end!.y);
    context.stroke();
  }
}

/** A point in the world, in wu. */
export interface DetailPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * One seeded line detail of the field, in wu from the dish centre: a mire strand (a quadratic curve through
 * `control`) or a stage scratch (straight, `control` null). The dish layer strokes these at world scale
 * (`dish/dish-details.ts`), so they stay sharp at every zoom instead of riding the 0.33 px/wu field bake.
 */
export interface DishDetailStroke {
  readonly start: DetailPoint;
  readonly control: DetailPoint | null;
  readonly end: DetailPoint;
  readonly widthWu: number;
  readonly colour: string;
  readonly alpha: number;
}

/** One strand: a short gentle curve from a seeded root anywhere in the patch, bent sideways, at a seeded alpha. */
function placeStrand(patch: GelPatchView, colour: string, random: RandomSource): DishDetailStroke {
  const rootAngle = random.nextFloat() * RADIANS_PER_FULL_TURN;
  const rootDistance = Math.sqrt(random.nextFloat()) * MIRE_STRAND.rootShareMax * patch.radius;
  const start = { x: patch.x + Math.cos(rootAngle) * rootDistance, y: patch.y + Math.sin(rootAngle) * rootDistance };
  const heading = random.nextFloat() * RADIANS_PER_FULL_TURN;
  const length = lerp(MIRE_STRAND.lengthShareMin, MIRE_STRAND.lengthShareMax, random.nextFloat()) * patch.radius;
  const bend = (random.nextFloat() - HALF) * MIRE_STRAND.bendShare * length;
  const end = { x: start.x + Math.cos(heading) * length, y: start.y + Math.sin(heading) * length };
  const control = {
    x: (start.x + end.x) * HALF - Math.sin(heading) * bend,
    y: (start.y + end.y) * HALF + Math.cos(heading) * bend,
  };
  const alpha = lerp(MIRE_STRAND_ALPHA_MIN, MIRE_STRAND_ALPHA_MAX, random.nextFloat());
  const widthWu = lerp(MIRE_STRAND.widthWuMin, MIRE_STRAND.widthWuMax, random.nextFloat());
  return { start, control, end, widthWu, colour, alpha };
}

/** `MIRE_STRANDS_PER_PATCH` strands over a gel patch, placed from `random`. */
export function placeMireStrands(patch: GelPatchView, colour: string, random: RandomSource): DishDetailStroke[] {
  return Array.from({ length: MIRE_STRANDS_PER_PATCH }, () => placeStrand(patch, colour, random));
}

/** `STAGE_SCRATCHES.count` faint short lines on the stage between the wall and `halfExtentWu` from the centre. */
export function placeStageScratches(halfExtentWu: number, random: RandomSource): DishDetailStroke[] {
  const scratches = STAGE_SCRATCHES;
  const innerWu = DISH_RADIUS + WALL_GLASS_WU * scratches.innerMarginGlass;
  return Array.from({ length: scratches.count }, () => {
    const angle = random.nextFloat() * RADIANS_PER_FULL_TURN;
    const distance = lerp(innerWu, halfExtentWu, random.nextFloat());
    const heading = random.nextFloat() * RADIANS_PER_FULL_TURN;
    const length = lerp(scratches.lengthWuMin, scratches.lengthWuMax, random.nextFloat());
    const start = { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
    const end = { x: start.x + Math.cos(heading) * length, y: start.y + Math.sin(heading) * length };
    const alpha = lerp(scratches.alphaMin, scratches.alphaMax, random.nextFloat());
    return { start, control: null, end, widthWu: scratches.widthWu, colour: STAGE_SCRATCH, alpha };
  });
}
