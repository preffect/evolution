// The condenser light pool (docs/VISUAL-STYLE.md §1, docs/RENDERING.md §6.1, sheet 02 `light-pool`):
// the `LIGHT_ACCENT` radial gradient and the three caustic sweeps, baked once per session on a
// `LIGHT_POOL_TEXTURE_PX` square and drawn by the dish layer as one sprite it keeps anchored to the
// view over the field. Per-axis mapping: the half-size is the pool's radius on each axis, so x maps
// at 512 / 980 and y at 512 / 760 texel per wu and the sprite's non-uniform scale restores sheet
// 02's proportions; stroke widths take the x factor under the `FIELD_MIN_STROKE_TEXELS` floor.
// The third sweep's tail past the y radius is clipped by design (the pool is already 0 there).

import {
  LIGHT_ACCENT,
  LIGHT_POOL_ALPHA,
  LIGHT_POOL_MID,
  LIGHT_POOL_SHEET_RADII_WU,
  LIGHT_POOL_TEXTURE_PX,
} from '../constants';
import { HALF } from '../geometry';
import { paintCaustics, type FieldScale } from './dish-field-details';
import { fillRadial, type BakeCanvas, type BakeCanvasFactory } from './texture-bake';

/** Texels per wu on each axis: the bake's half-size over the sheet's radius on that axis. */
export function lightPoolBakeScale(): Required<FieldScale> {
  const halfSizePx = LIGHT_POOL_TEXTURE_PX * HALF;
  return { pxPerWu: halfSizePx / LIGHT_POOL_SHEET_RADII_WU.x, pxPerWuY: halfSizePx / LIGHT_POOL_SHEET_RADII_WU.y };
}

/** The pool: the gradient over the whole square, then the caustics around its centre. */
export function bakeLightPool(factory: BakeCanvasFactory): BakeCanvas {
  const sizePx = LIGHT_POOL_TEXTURE_PX;
  const centre = sizePx * HALF;
  const canvas = factory.create(sizePx, sizePx);
  fillRadial(canvas.context, { x: centre, y: centre, radius: centre }, [
    { offset: 0, colour: LIGHT_ACCENT, alpha: LIGHT_POOL_ALPHA },
    { offset: LIGHT_POOL_MID.stop, colour: LIGHT_ACCENT, alpha: LIGHT_POOL_MID.alpha },
    { offset: 1, colour: LIGHT_ACCENT, alpha: 0 },
  ]);
  paintCaustics(canvas.context, { x: centre, y: centre }, lightPoolBakeScale());
  return canvas;
}
