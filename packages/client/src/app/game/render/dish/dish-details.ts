// The field's line details at world scale (docs/rendering/budget.md §6, visual-style/performance-and-checklist.md
// §8, #223): the mire strands over each gel patch and the stage scratches outside the wall. Their placements come
// from the field bake (textures/dish-field-details.ts, the dish sub-stream), but they are drawn here in wu into
// the dish layer's wall Graphics, under the wall's lines, so at zoom 1 and 1.8 they are as sharp as the wall instead of
// being magnified 3–5 × out of the 0.33 px/wu field. The zoom band only decides how far a thin line is widened:
// no line is drawn thinner than `DISH_DETAIL_MIN_STROKE_PX` at its band's lowest zoom, which at the far band
// matches the one-texel floor the field bake used to give them. The Graphics is redrawn only on a band change.

import type { Graphics } from 'pixi.js';
import { hexToNumber } from '../colour';
import { DISH_DETAIL_BAND_MIN_ZOOMS, DISH_DETAIL_MIN_STROKE_PX } from '../constants';
import type { DishDetailStroke } from '../textures/dish-field-details';

/** An index into `DISH_DETAIL_BAND_MIN_ZOOMS`, far (0) → near. */
export type DishDetailBand = number;

/** The band a zoom (CSS px per wu) draws in: the nearest band whose lowest zoom it reaches, else the far band. */
export function dishDetailBandFor(zoom: number): DishDetailBand {
  let band = 0;
  DISH_DETAIL_BAND_MIN_ZOOMS.forEach((minZoom, index) => {
    if (zoom >= minZoom) band = index;
  });
  return band;
}

/** A detail's width in wu for `band`: its own width, or the band's one-px floor when that is wider. */
export function dishDetailWidthWu(widthWu: number, band: DishDetailBand): number {
  const bandMinZoom = DISH_DETAIL_BAND_MIN_ZOOMS[band] ?? DISH_DETAIL_BAND_MIN_ZOOMS[0];
  return Math.max(widthWu, DISH_DETAIL_MIN_STROKE_PX / bandMinZoom);
}

/** Replaces `graphics`' content with every detail stroke, round-capped, widened for `band`. */
export function drawDishDetails(graphics: Graphics, details: readonly DishDetailStroke[], band: DishDetailBand): void {
  graphics.clear();
  for (const detail of details) {
    graphics.moveTo(detail.start.x, detail.start.y);
    if (detail.control === null) graphics.lineTo(detail.end.x, detail.end.y);
    else graphics.quadraticCurveTo(detail.control.x, detail.control.y, detail.end.x, detail.end.y);
    graphics.stroke({
      width: dishDetailWidthWu(detail.widthWu, band),
      color: hexToNumber(detail.colour),
      alpha: detail.alpha,
      cap: 'round',
    });
  }
}
