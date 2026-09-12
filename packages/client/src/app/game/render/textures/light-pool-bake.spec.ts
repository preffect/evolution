import { describe, expect, it } from 'vitest';
import { createFakeBakeCanvasFactory, fakeContextOf } from '../../../../testing/fake-bake-canvas';
import { hexWithAlpha } from '../colour';
import {
  CAUSTIC_ALPHA,
  CAUSTIC_SWEEPS,
  FIELD_MIN_STROKE_TEXELS,
  LIGHT_ACCENT,
  LIGHT_POOL_ALPHA,
  LIGHT_POOL_MID,
  LIGHT_POOL_SHEET_RADII_WU,
  LIGHT_POOL_TEXTURE_PX,
} from '../constants';
import { HALF } from '../geometry';
import { fieldStrokePx } from './dish-field-details';
import { bakeLightPool, lightPoolBakeScale } from './light-pool-bake';

const HALF_SIZE_PX = LIGHT_POOL_TEXTURE_PX * HALF;

function bake() {
  const canvas = bakeLightPool(createFakeBakeCanvasFactory());
  return { canvas, context: fakeContextOf(canvas) };
}

describe('lightPoolBakeScale', () => {
  it('maps each axis so the half-size is the sheet radius on that axis (RENDERING §6.1: 0.52 and 0.67 texel/wu)', () => {
    const scale = lightPoolBakeScale();
    expect(scale.pxPerWu).toBeCloseTo(HALF_SIZE_PX / LIGHT_POOL_SHEET_RADII_WU.x, 6);
    expect(scale.pxPerWuY).toBeCloseTo(HALF_SIZE_PX / LIGHT_POOL_SHEET_RADII_WU.y, 6);
    expect(scale.pxPerWu).toBeLessThan(scale.pxPerWuY);
  });
});

describe('bakeLightPool', () => {
  it('bakes a LIGHT_POOL_TEXTURE_PX square', () => {
    const { canvas } = bake();
    expect(canvas.width).toBe(LIGHT_POOL_TEXTURE_PX);
    expect(canvas.height).toBe(LIGHT_POOL_TEXTURE_PX);
  });

  it('fills one radial gradient over the whole square: the accent at the pool alpha, the mid stop, clear at the rim', () => {
    const { context } = bake();
    expect(context.gradients).toHaveLength(1);
    const [gradient] = context.gradients;
    expect(gradient!.kind).toBe('radial');
    expect(gradient!.geometry).toEqual([HALF_SIZE_PX, HALF_SIZE_PX, 0, HALF_SIZE_PX, HALF_SIZE_PX, HALF_SIZE_PX]);
    expect(gradient!.stops).toEqual([
      { offset: 0, colour: hexWithAlpha(LIGHT_ACCENT, LIGHT_POOL_ALPHA) },
      { offset: LIGHT_POOL_MID.stop, colour: hexWithAlpha(LIGHT_ACCENT, LIGHT_POOL_MID.alpha) },
      { offset: 1, colour: hexWithAlpha(LIGHT_ACCENT, 0) },
    ]);
    expect(context.count('fill')).toBe(1);
  });

  it('strokes one cubic per sweep, its points mapped per axis from the pool centre, in the accent at the caustic alpha', () => {
    const { context } = bake();
    const scale = lightPoolBakeScale();
    const toTexel = (point: { x: number; y: number }) => [
      HALF_SIZE_PX + point.x * scale.pxPerWu,
      HALF_SIZE_PX + point.y * scale.pxPerWuY,
    ];
    const starts = context.argumentsOf('moveTo');
    const curves = context.argumentsOf('bezierCurveTo');
    expect(curves).toHaveLength(CAUSTIC_SWEEPS.length);
    CAUSTIC_SWEEPS.forEach((sweep, index) => {
      expect(starts[index]).toEqual(toTexel(sweep.start));
      expect(curves[index]).toEqual([...toTexel(sweep.control1), ...toTexel(sweep.control2), ...toTexel(sweep.end)]);
    });
    expect(context.strokeStyle).toBe(hexWithAlpha(LIGHT_ACCENT, CAUSTIC_ALPHA));
    expect(context.lineCap).toBe('round');
  });

  it('keeps every stroke at or above the texel floor, the widest sweep above it and the thinnest on it', () => {
    const { context } = bake();
    const scale = lightPoolBakeScale();
    const widths = context.argumentsOf('stroke').map(([lineWidth]) => lineWidth);
    expect(widths).toHaveLength(CAUSTIC_SWEEPS.length);
    for (const width of widths) expect(width).toBeGreaterThanOrEqual(FIELD_MIN_STROKE_TEXELS);
    expect(widths).toEqual(CAUSTIC_SWEEPS.map((sweep) => fieldStrokePx(sweep.widthWu, scale)));
    expect(widths[0]).toBeGreaterThan(FIELD_MIN_STROKE_TEXELS);
    expect(widths.at(-1)).toBe(FIELD_MIN_STROKE_TEXELS);
  });

  it('clips the third sweep by design: its start lies past the y radius, its end inside the square', () => {
    const { context } = bake();
    const [, , third] = context.argumentsOf('moveTo');
    expect(third![1]).toBeGreaterThan(LIGHT_POOL_TEXTURE_PX);
    const [, , curve] = context.argumentsOf('bezierCurveTo');
    expect(curve![4]).toBeLessThanOrEqual(LIGHT_POOL_TEXTURE_PX);
    expect(curve![5]).toBeGreaterThanOrEqual(0);
  });
});
