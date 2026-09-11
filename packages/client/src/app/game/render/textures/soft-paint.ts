// Soft-edged primitives for the bakes (docs/VISUAL-STYLE.md §1 "one hard edge", §8 "filters run only
// at texture build time"): the sheets' `blur N` becomes a feather of N wu past a shape's rim, drawn
// as a gradient (an ellipse) or as concentric strokes (a path), so no canvas filter is needed.

import { hexWithAlpha } from '../colour';
import { SOFT_STROKE_LAYERS } from '../constants';
import { DIAMETER_PER_RADIUS } from '../geometry';
import { fillRadial, type BakeContext2D, type EllipseSpec, type Paint } from './texture-bake';

const FULLY_OPAQUE = 1;

/** A filled ellipse whose rim fades out over `featherPx` on both sides: the sheet's blurred ellipse. */
export function fillFeatheredEllipse(
  context: BakeContext2D,
  ellipse: EllipseSpec,
  paint: Paint,
  featherPx: number,
): void {
  const outerX = ellipse.radiusX + featherPx;
  const outerY = ellipse.radiusY + featherPx;
  const innerStop = Math.max(0, (ellipse.radiusX - featherPx) / outerX);
  context.save();
  context.translate(ellipse.x, ellipse.y);
  context.rotate(ellipse.rotation);
  context.scale(1, outerY / outerX);
  fillRadial(context, { x: 0, y: 0, radius: outerX }, [
    { offset: 0, colour: paint.colour, alpha: paint.alpha },
    { offset: innerStop, colour: paint.colour, alpha: paint.alpha },
    { offset: 1, colour: paint.colour, alpha: 0 },
  ]);
  context.restore();
}

export interface PathPoint {
  readonly x: number;
  readonly y: number;
}

/** `moveTo` the point at share 0 then `lineTo` each of `steps` further shares to 1: a polyline over `pointAt`. */
export function tracePolyline(context: BakeContext2D, steps: number, pointAt: (share: number) => PathPoint): void {
  for (let step = 0; step <= steps; step += 1) {
    const point = pointAt(step / steps);
    if (step === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  }
}

export interface SoftStroke extends Paint {
  readonly widthPx: number;
  /** How far past the stroke's edge it fades; 0 strokes once, crisp. */
  readonly featherPx: number;
}

/** The alpha each of `layers` overlapping strokes needs so they composite to `alpha` where all overlap. */
export function layerAlphaFor(alpha: number, layers: number): number {
  return FULLY_OPAQUE - (FULLY_OPAQUE - alpha) ** (FULLY_OPAQUE / layers);
}

/**
 * A path stroked soft: `SOFT_STROKE_LAYERS` round-capped strokes from `width + feather on both sides` down to
 * `width`, each at the share that composites to the stroke's alpha along its spine. `tracePath`
 * lays the path down (after `beginPath`) each time.
 */
export function strokeSoft(
  context: BakeContext2D,
  tracePath: (context: BakeContext2D) => void,
  stroke: SoftStroke,
): void {
  const layers = stroke.featherPx > 0 ? SOFT_STROKE_LAYERS : 1;
  context.lineCap = 'round';
  context.strokeStyle = hexWithAlpha(stroke.colour, layerAlphaFor(stroke.alpha, layers));
  for (let layer = 0; layer < layers; layer += 1) {
    const reach = layers === 1 ? 0 : 1 - layer / (layers - 1);
    context.lineWidth = stroke.widthPx + DIAMETER_PER_RADIUS * stroke.featherPx * reach;
    context.beginPath();
    tracePath(context);
    context.stroke();
  }
}
