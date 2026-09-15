import { describe, expect, it } from 'vitest';
import { FakeBakeContext, createFakeBakeCanvasFactory, fakeContextOf } from '../../../../testing/fake-bake-canvas';
import { hexWithAlpha } from '../colour';
import {
  CALLOUT_BACKING,
  CUE_PILL_HEIGHT_PX,
  CUE_PILL_PAD_PX,
  CUE_RIM_PX,
  DANGER,
  DANGER_LABEL_RIM_PX,
  GAIN,
  LABEL_PILL_ALPHA,
  LABEL_PILL_BAKE,
  LABEL_PILL_HEIGHT_PX,
  LABEL_PILL_PAD_PX,
  PANEL_TOP,
  SOFT_STROKE_LAYERS,
} from '../constants';
import {
  bakeLabelPill,
  bakePill,
  cuePillSpec,
  labelPillSpriteSizePx,
  labelPillWidthPx,
  pillWidthPx,
  tracePill,
} from './label-pill-bake';

describe('bakePill for a cue (docs/ui/hud.md §3.1.5)', () => {
  it('pads the content by CUE_PILL_PAD_PX at each end', () => {
    expect(pillWidthPx(100, cuePillSpec(null))).toBe(100 + 2 * CUE_PILL_PAD_PX);
  });

  it('bakes a CUE_PILL_HEIGHT_PX pill with a CUE_RIM_PX rim and glow in the role colour', () => {
    const sprite = bakePill(createFakeBakeCanvasFactory(), 1, cuePillSpec(GAIN));
    const context = fakeContextOf(sprite.canvas);
    expect(sprite.heightPx).toBe(CUE_PILL_HEIGHT_PX + 2 * LABEL_PILL_BAKE.glowPx);
    expect(sprite.capWidthPx).toBe(LABEL_PILL_BAKE.glowPx + CUE_PILL_HEIGHT_PX / 2);
    const strokes = context.argumentsOf('stroke');
    expect(strokes).toHaveLength(SOFT_STROKE_LAYERS + 2);
    expect(strokes.at(-1)).toEqual([CUE_RIM_PX]);
    expect(context.strokeStyle).toBe(GAIN);
  });

  it('bakes neither glow nor rim for an unrimmed pill: only the top highlight is stroked', () => {
    const context = fakeContextOf(bakePill(createFakeBakeCanvasFactory(), 1, cuePillSpec(null)).canvas);
    expect(context.argumentsOf('stroke')).toHaveLength(1);
  });
});

describe('labelPillWidthPx', () => {
  it('pads the text by LABEL_PILL_PAD_PX at each end and is never narrower than round', () => {
    expect(labelPillWidthPx(100)).toBe(100 + 2 * LABEL_PILL_PAD_PX);
    expect(labelPillWidthPx(0)).toBe(LABEL_PILL_HEIGHT_PX);
  });

  it('adds the glow margin on every side for the sprite', () => {
    expect(labelPillSpriteSizePx(116)).toEqual({
      width: 116 + 2 * LABEL_PILL_BAKE.glowPx,
      height: LABEL_PILL_HEIGHT_PX + 2 * LABEL_PILL_BAKE.glowPx,
    });
  });
});

describe('tracePill', () => {
  it('draws a stadium: two caps of half the height joined by straight edges', () => {
    const context = new FakeBakeContext();
    tracePill(context, { x: 0, y: 0, width: 40, height: 18 });
    const arcs = context.argumentsOf('arc');
    expect(arcs.map((args) => [args[0], args[1], args[2]])).toEqual([
      [31, 9, 9],
      [9, 9, 9],
    ]);
    expect(context.argumentsOf('lineTo')).toEqual([
      [31, 0],
      [9, 18],
    ]);
  });
});

describe('bakeLabelPill', () => {
  const sprite = bakeLabelPill(createFakeBakeCanvasFactory(), 2);
  const context = fakeContextOf(sprite.canvas);

  it('bakes the narrowest pill: two caps and the stretch column, whose borders make up the whole width', () => {
    // A nine-slice stretches only what lies between the borders, so caps + column must be the bake.
    expect(sprite.capWidthPx).toBe(LABEL_PILL_BAKE.glowPx + LABEL_PILL_HEIGHT_PX / 2);
    expect(sprite.marginPx).toBe(LABEL_PILL_BAKE.glowPx);
    expect(sprite.widthPx).toBe(sprite.capWidthPx * 2 + LABEL_PILL_BAKE.stretchPx);
    expect(sprite.heightPx).toBe(LABEL_PILL_HEIGHT_PX + LABEL_PILL_BAKE.glowPx * 2);
    expect(sprite.canvas.width).toBe(sprite.widthPx * 2);
  });

  it('layers a soft danger glow, a body lit toward the top, a top highlight and the danger rim last', () => {
    const body = context.gradients.find((gradient) => gradient.kind === 'linear')!;
    expect(body.stops.map((stop) => stop.colour)).toEqual([
      hexWithAlpha(PANEL_TOP, LABEL_PILL_ALPHA),
      hexWithAlpha(CALLOUT_BACKING, LABEL_PILL_ALPHA),
    ]);
    const strokes = context.argumentsOf('stroke');
    expect(strokes).toHaveLength(SOFT_STROKE_LAYERS + 2);
    expect(strokes.at(-1)).toEqual([DANGER_LABEL_RIM_PX]);
    expect(context.strokeStyle).toBe(DANGER);
    // The rim sits inside the pill's box, so the backing's edge is the rim and nothing pokes past it.
    const rimArcs = context.argumentsOf('arc').slice(-2);
    for (const args of rimArcs) expect(args[2]).toBe((LABEL_PILL_HEIGHT_PX - DANGER_LABEL_RIM_PX) / 2);
  });
});
