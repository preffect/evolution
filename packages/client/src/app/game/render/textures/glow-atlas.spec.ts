import { describe, expect, it } from 'vitest';
import { createFakeBakeCanvasFactory, fakeContextOf } from '../../../../testing/fake-bake-canvas';
import { GLOW_TEXTURE_PX, RAY_TEXTURE_PX, RING_TEXTURE_PX } from '../constants';
import { GLOW_SPRITE, bakeGlowAtlas } from './glow-atlas';

describe('bakeGlowAtlas', () => {
  const atlas = bakeGlowAtlas(createFakeBakeCanvasFactory());

  it('bakes the three white sprites at their sizes', () => {
    expect(Object.keys(atlas).sort()).toEqual(Object.values(GLOW_SPRITE).sort());
    expect([atlas.glow.width, atlas.ring.width, atlas.ray.width, atlas.ray.height]).toEqual([
      GLOW_TEXTURE_PX,
      RING_TEXTURE_PX,
      RAY_TEXTURE_PX.width,
      RAY_TEXTURE_PX.height,
    ]);
  });

  it('layers the glow as wide + soft + core, every halo fading to transparent white', () => {
    const context = fakeContextOf(atlas.glow);
    expect(context.paintCount).toBe(3);
    for (const gradient of context.gradients) {
      expect(gradient.stops[0]!.colour).toMatch(/^rgba\(255, 255, 255, /);
      expect(gradient.stops.at(-1)!.colour).toBe('rgba(255, 255, 255, 0)');
    }
  });

  it('bakes the ring hollow and the ray brightest at its base', () => {
    const ring = fakeContextOf(atlas.ring).gradients[0]!.stops;
    expect(ring[0]!.colour).toBe('rgba(255, 255, 255, 0)');
    expect(ring[1]!.colour).toBe('rgba(255, 255, 255, 1)');
    expect(ring.at(-1)!.colour).toBe('rgba(255, 255, 255, 0)');
    const ray = fakeContextOf(atlas.ray).gradients[0]!;
    expect(ray.kind).toBe('linear');
    expect(ray.stops[0]!.colour).toBe('rgba(255, 255, 255, 0.9)');
    expect(ray.stops.at(-1)!.colour).toBe('rgba(255, 255, 255, 0)');
  });
});
