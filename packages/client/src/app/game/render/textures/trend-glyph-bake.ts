// The legibility cues' two small glyphs (docs/ui/hud.md §3.1.5), both baked once in white and tinted where drawn:
// the mass chip's trend triangle, `TREND_GLYPH_PX` tall and pointing up (the drawing tints it `GAIN` up or `DANGER`
// down and turns it half a turn for down, so the direction is geometry as well as colour), and the zone pill's dot,
// `ZONE_PILL_DOT_PX` across (tinted the zone's `ZONE_CUE`). CSS px.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { TREND_GLYPH_PX, WHITE, ZONE_PILL_DOT_PX } from '../constants';
import { HALF } from '../geometry';
import { createPxCanvas, type BakeCanvasFactory, type PxBakedSprite } from './texture-bake';

/** The trend glyph's square: as wide as it is tall. */
export const TREND_GLYPH_WIDTH_PX = TREND_GLYPH_PX;

export function bakeTrendGlyph(factory: BakeCanvasFactory, scale: number): PxBakedSprite {
  const sprite = createPxCanvas(factory, TREND_GLYPH_WIDTH_PX, TREND_GLYPH_PX, scale);
  const { context } = sprite.canvas;
  context.fillStyle = WHITE;
  context.beginPath();
  context.moveTo(TREND_GLYPH_WIDTH_PX * HALF, 0);
  context.lineTo(TREND_GLYPH_WIDTH_PX, TREND_GLYPH_PX);
  context.lineTo(0, TREND_GLYPH_PX);
  context.closePath();
  context.fill();
  return sprite;
}

export function bakeZoneDot(factory: BakeCanvasFactory, scale: number): PxBakedSprite {
  const sprite = createPxCanvas(factory, ZONE_PILL_DOT_PX, ZONE_PILL_DOT_PX, scale);
  const { context } = sprite.canvas;
  const radius = ZONE_PILL_DOT_PX * HALF;
  context.fillStyle = WHITE;
  context.beginPath();
  context.arc(radius, radius, radius, 0, RADIANS_PER_FULL_TURN);
  context.fill();
  return sprite;
}
