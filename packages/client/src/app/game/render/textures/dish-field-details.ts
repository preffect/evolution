// The line details of the field and the light pool (sheet 02): the three caustic sweeps across the
// pool (light-pool-bake.ts), the mire strands scattered over each gel patch and the stage scratches
// outside the wall. All are drawn into a coarse bake (the 0.33 px/wu field, the pool at 0.52 × 0.67
// texel/wu), so a stroke thinner than `FIELD_MIN_STROKE_TEXELS` is widened to that and read by its
// alpha alone; the per-band detail sprites of VISUAL-STYLE §8 are #223's.

import { DISH_RADIUS, RADIANS_PER_FULL_TURN, lerp, type RandomSource } from '@evolution/shared';
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
import type { BakeContext2D, DiscSpec } from './texture-bake';

/** A point in the field texture, in px. */
export interface FieldPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * The texture's scale: wu to px on x (stroke widths follow it), and on y when the bake maps the axes
 * apart (the light pool, RENDERING §6.1); `pxPerWuY` defaults to `pxPerWu`.
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

export interface StrandPlacement {
  readonly colour: string;
  readonly random: RandomSource;
  readonly scale: FieldScale;
}

/** One strand: a short gentle curve from a seeded root anywhere in the patch, bent sideways, at a seeded alpha. */
function paintStrand(context: BakeContext2D, disc: DiscSpec, placement: StrandPlacement): void {
  const { random, scale } = placement;
  const rootAngle = random.nextFloat() * RADIANS_PER_FULL_TURN;
  const rootDistance = Math.sqrt(random.nextFloat()) * MIRE_STRAND.rootShareMax * disc.radius;
  const root = { x: disc.x + Math.cos(rootAngle) * rootDistance, y: disc.y + Math.sin(rootAngle) * rootDistance };
  const heading = random.nextFloat() * RADIANS_PER_FULL_TURN;
  const length = lerp(MIRE_STRAND.lengthShareMin, MIRE_STRAND.lengthShareMax, random.nextFloat()) * disc.radius;
  const bend = (random.nextFloat() - HALF) * MIRE_STRAND.bendShare * length;
  const end = { x: root.x + Math.cos(heading) * length, y: root.y + Math.sin(heading) * length };
  const control = {
    x: (root.x + end.x) * HALF - Math.sin(heading) * bend,
    y: (root.y + end.y) * HALF + Math.cos(heading) * bend,
  };
  context.strokeStyle = hexWithAlpha(
    placement.colour,
    lerp(MIRE_STRAND_ALPHA_MIN, MIRE_STRAND_ALPHA_MAX, random.nextFloat()),
  );
  context.lineWidth = fieldStrokePx(lerp(MIRE_STRAND.widthWuMin, MIRE_STRAND.widthWuMax, random.nextFloat()), scale);
  context.beginPath();
  context.moveTo(root.x, root.y);
  context.quadraticCurveTo(control.x, control.y, end.x, end.y);
  context.stroke();
}

/** `MIRE_STRANDS_PER_PATCH` strands over a patch disc, placed from the placement's stream. */
export function paintMireStrands(context: BakeContext2D, disc: DiscSpec, placement: StrandPlacement): void {
  context.lineCap = 'round';
  for (let strand = 0; strand < MIRE_STRANDS_PER_PATCH; strand += 1) paintStrand(context, disc, placement);
}

/** `STAGE_SCRATCHES.count` faint short lines on the stage between the wall and the texture's edge. */
export function paintStageScratches(
  context: BakeContext2D,
  frame: { centre: number; halfExtentWu: number },
  placement: { random: RandomSource; scale: FieldScale },
): void {
  const { random, scale } = placement;
  const scratches = STAGE_SCRATCHES;
  const innerWu = DISH_RADIUS + WALL_GLASS_WU * scratches.innerMarginGlass;
  context.lineCap = 'round';
  context.lineWidth = fieldStrokePx(scratches.widthWu, scale);
  for (let scratch = 0; scratch < scratches.count; scratch += 1) {
    const angle = random.nextFloat() * RADIANS_PER_FULL_TURN;
    const distance = lerp(innerWu, frame.halfExtentWu, random.nextFloat()) * scale.pxPerWu;
    const heading = random.nextFloat() * RADIANS_PER_FULL_TURN;
    const length = lerp(scratches.lengthWuMin, scratches.lengthWuMax, random.nextFloat()) * scale.pxPerWu;
    const from = { x: frame.centre + Math.cos(angle) * distance, y: frame.centre + Math.sin(angle) * distance };
    context.strokeStyle = hexWithAlpha(STAGE_SCRATCH, lerp(scratches.alphaMin, scratches.alphaMax, random.nextFloat()));
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(from.x + Math.cos(heading) * length, from.y + Math.sin(heading) * length);
    context.stroke();
  }
}
