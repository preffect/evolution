import { describe, expect, it } from 'vitest';
import { DISH_RADIUS } from '@evolution/shared';
import { createFakeBakeCanvasFactory, type FakeBakeCanvas } from '../../../../testing/fake-bake-canvas';
import { FIELD_TEXTURE_PX, MIRE_STRANDS_PER_PATCH, VIGNETTE_TEXTURE_PX } from '../constants';
import { bakeDishField, bakeVignette } from './dish-texture';

describe('bakeDishField', () => {
  it('covers the dish and its wall at the field resolution', () => {
    const field = bakeDishField(createFakeBakeCanvasFactory(), []);
    expect(field.canvas.width).toBe(FIELD_TEXTURE_PX);
    expect(field.halfExtentWu).toBeGreaterThan(DISH_RADIUS);
    expect(field.wuPerPx * FIELD_TEXTURE_PX).toBeCloseTo(field.halfExtentWu * 2, 6);
  });

  it('paints the field, the light pool and caustics, the zones, the vent and the outside', () => {
    const field = bakeDishField(createFakeBakeCanvasFactory(), []);
    const context = (field.canvas as FakeBakeCanvas).context;
    expect(context.ops[0]).toBe('fillRect');
    expect(context.paintCount).toBeGreaterThanOrEqual(10);
    expect(context.gradients.length).toBeGreaterThanOrEqual(3);
  });

  it('draws every gel patch with its strands', () => {
    const bare = (bakeDishField(createFakeBakeCanvasFactory(), []).canvas as FakeBakeCanvas).context.paintCount;
    const patched = bakeDishField(createFakeBakeCanvasFactory(), [
      { x: 500, y: 500, radius: 350 },
      { x: -900, y: 200, radius: 350 },
    ]).canvas as FakeBakeCanvas;
    expect(patched.context.paintCount).toBe(bare + 2 * (1 + MIRE_STRANDS_PER_PATCH));
  });

  it('bakes the vignette as one radial gradient that is clear in the middle', () => {
    const vignette = bakeVignette(createFakeBakeCanvasFactory()) as FakeBakeCanvas;
    expect(vignette.width).toBe(VIGNETTE_TEXTURE_PX);
    expect(vignette.context.gradients[0]!.stops[0]!.colour).toBe('rgba(0, 0, 0, 0)');
    expect(vignette.context.gradients[0]!.stops.at(-1)!.colour).toBe('rgba(0, 0, 0, 0.55)');
  });
});
