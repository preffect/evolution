import { describe, expect, it } from 'vitest';
import { FakeBakeContext } from '../../../../testing/fake-bake-canvas';
import { SOFT_STROKE_LAYERS, WHITE } from '../constants';
import { hexWithAlpha } from '../colour';
import { fillFeatheredEllipse, layerAlphaFor, strokeSoft } from './soft-paint';

describe('fillFeatheredEllipse', () => {
  it('fills one radial gradient over the feathered radius, solid inside the rim minus the feather, clear outside', () => {
    const context = new FakeBakeContext();
    fillFeatheredEllipse(
      context,
      { x: 10, y: 20, radiusX: 100, radiusY: 50, rotation: 0.3 },
      { colour: WHITE, alpha: 0.5 },
      20,
    );
    expect(context.paintCount).toBe(1);
    expect(context.ops.slice(0, 4)).toEqual(['save', 'translate', 'rotate', 'scale']);
    expect(context.ops.at(-1)).toBe('restore');
    const [gradient] = context.gradients;
    expect(gradient!.stops.map((stop) => stop.offset)).toEqual([0, (100 - 20) / 120, 1]);
    expect(gradient!.stops[0]!.colour).toBe(hexWithAlpha(WHITE, 0.5));
    expect(gradient!.stops.at(-1)!.colour).toBe(hexWithAlpha(WHITE, 0));
  });

  it('never puts the inner stop below zero when the feather exceeds the radius', () => {
    const context = new FakeBakeContext();
    fillFeatheredEllipse(context, { x: 0, y: 0, radiusX: 2, radiusY: 2, rotation: 0 }, { colour: WHITE, alpha: 1 }, 5);
    expect(context.gradients[0]!.stops[1]!.offset).toBe(0);
  });
});

describe('strokeSoft', () => {
  it('strokes once, crisp, when the feather is zero', () => {
    const context = new FakeBakeContext();
    strokeSoft(context, (path) => path.lineTo(1, 1), { colour: WHITE, alpha: 0.4, widthPx: 3, featherPx: 0 });
    expect(context.count('stroke')).toBe(1);
    expect(context.lineWidth).toBe(3);
    expect(context.strokeStyle).toBe(hexWithAlpha(WHITE, 0.4));
    expect(context.lineCap).toBe('round');
  });

  it('strokes the layers from widest to the stroke width, at the alpha that composites back to the stroke alpha', () => {
    const context = new FakeBakeContext();
    const widths: number[] = [];
    context.stroke = () => widths.push(context.lineWidth);
    strokeSoft(context, (path) => path.lineTo(1, 1), { colour: WHITE, alpha: 0.55, widthPx: 9, featherPx: 6 });
    expect(widths).toHaveLength(SOFT_STROKE_LAYERS);
    expect(widths[0]).toBe(9 + 12);
    expect(widths.at(-1)).toBe(9);
    expect([...widths].sort((left, right) => right - left)).toEqual(widths);
    const layerAlpha = layerAlphaFor(0.55, SOFT_STROKE_LAYERS);
    expect(1 - (1 - layerAlpha) ** SOFT_STROKE_LAYERS).toBeCloseTo(0.55, 12);
  });
});
