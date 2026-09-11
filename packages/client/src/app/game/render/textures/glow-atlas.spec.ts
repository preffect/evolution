import { describe, expect, it } from 'vitest';
import { createFakeBakeCanvasFactory, type FakeBakeCanvas } from '../../../../testing/fake-bake-canvas';
import { GLOW_TEXTURE_PX, RAY_TEXTURE_PX, RING_TEXTURE_PX } from '../constants';
import { GLOW_SPRITE, bakeGlowAtlas } from './glow-atlas';

describe('bakeGlowAtlas', () => {
  const factory = createFakeBakeCanvasFactory();
  const atlas = bakeGlowAtlas(factory);
  const fake = (key: keyof typeof atlas) => atlas[key] as FakeBakeCanvas;

  it('bakes the four white sprites at their sizes', () => {
    expect(Object.keys(atlas).sort()).toEqual(Object.values(GLOW_SPRITE).sort());
    expect([atlas.glow.width, atlas.ring.width, atlas.ray.height]).toEqual([
      GLOW_TEXTURE_PX,
      RING_TEXTURE_PX,
      RAY_TEXTURE_PX.height,
    ]);
  });

  it('layers the glow as core + soft + wide and fades every gradient to transparent', () => {
    expect(fake('glow').context.paintCount).toBe(3);
    for (const gradient of fake('glow').context.gradients) {
      expect(gradient.stops.at(-1)!.colour).toBe('rgba(255, 255, 255, 0)');
    }
  });

  it('bakes the ring hollow and the ray brightest at its base', () => {
    const ring = fake('ring').context.gradients[0]!.stops;
    expect(ring[0]!.colour).toBe('rgba(255, 255, 255, 0)');
    expect(ring[1]!.colour).toBe('rgba(255, 255, 255, 1)');
    const ray = fake('ray').context.gradients[0]!.stops;
    expect(ray[0]!.colour).toBe('rgba(255, 255, 255, 0.9)');
    expect(ray.at(-1)!.colour).toBe('rgba(255, 255, 255, 0)');
  });
});
