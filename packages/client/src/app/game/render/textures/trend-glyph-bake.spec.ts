import { describe, expect, it } from 'vitest';
import { createFakeBakeCanvasFactory, fakeContextOf } from '../../../../testing/fake-bake-canvas';
import { TREND_GLYPH_PX, WHITE, ZONE_PILL_DOT_PX } from '../constants';
import { TREND_GLYPH_WIDTH_PX, bakeTrendGlyph, bakeZoneDot } from './trend-glyph-bake';

describe('bakeTrendGlyph', () => {
  const sprite = bakeTrendGlyph(createFakeBakeCanvasFactory(), 2);
  const context = fakeContextOf(sprite.canvas);

  it('bakes a TREND_GLYPH_PX square at the bake scale', () => {
    expect(sprite.widthPx).toBe(TREND_GLYPH_WIDTH_PX);
    expect(sprite.heightPx).toBe(TREND_GLYPH_PX);
    expect(sprite.canvas.width).toBe(TREND_GLYPH_WIDTH_PX * 2);
  });

  it('fills one white triangle pointing up, apex centred on the top edge', () => {
    expect(context.argumentsOf('moveTo')).toEqual([[TREND_GLYPH_WIDTH_PX / 2, 0]]);
    expect(context.argumentsOf('lineTo')).toEqual([
      [TREND_GLYPH_WIDTH_PX, TREND_GLYPH_PX],
      [0, TREND_GLYPH_PX],
    ]);
    expect(context.argumentsOf('fill')).toHaveLength(1);
    expect(context.fillStyle).toBe(WHITE);
  });
});

describe('bakeZoneDot', () => {
  const sprite = bakeZoneDot(createFakeBakeCanvasFactory(), 1);
  const context = fakeContextOf(sprite.canvas);

  it('fills one white disc ZONE_PILL_DOT_PX across, centred in its square', () => {
    expect([sprite.widthPx, sprite.heightPx]).toEqual([ZONE_PILL_DOT_PX, ZONE_PILL_DOT_PX]);
    const [arc] = context.argumentsOf('arc');
    expect(arc?.slice(0, 3)).toEqual([ZONE_PILL_DOT_PX / 2, ZONE_PILL_DOT_PX / 2, ZONE_PILL_DOT_PX / 2]);
    expect(context.argumentsOf('fill')).toHaveLength(1);
    expect(context.fillStyle).toBe(WHITE);
  });
});
