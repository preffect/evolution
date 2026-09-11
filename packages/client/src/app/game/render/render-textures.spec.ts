import { describe, expect, it } from 'vitest';
import { createFakeTextureBaker } from '../../../testing/fake-pixi-app';
import { GLOW_TEXTURE_PX, VIGNETTE_ALPHA, VIGNETTE_RADIUS_FRACTION, VIGNETTE_TEXTURE_PX } from './constants';
import {
  RADIAL_BAKE_SHAPE,
  SOFT_DISC_BAKE,
  VIGNETTE_BAKE,
  createRenderTextures,
  destroyRenderTextures,
} from './render-textures';

describe('createRenderTextures', () => {
  it('bakes the soft disc then the vignette through the baker', () => {
    const baker = createFakeTextureBaker();
    const textures = createRenderTextures({ seed: 7, baker });
    expect(baker.bakedSpecs).toEqual([SOFT_DISC_BAKE, VIGNETTE_BAKE]);
    expect(textures.seed).toBe(7);
    expect(textures.glowTexture).not.toBe(textures.vignetteTexture);
  });

  it('forks the cosmetic stream from the seed, so the same seed draws the same values', () => {
    const first = createRenderTextures({ seed: 42, baker: createFakeTextureBaker() });
    const second = createRenderTextures({ seed: 42, baker: createFakeTextureBaker() });
    const other = createRenderTextures({ seed: 43, baker: createFakeTextureBaker() });
    expect(first.cosmetic.nextFloat()).toBe(second.cosmetic.nextFloat());
    expect(first.cosmetic.nextFloat()).not.toBe(other.cosmetic.nextFloat());
  });

  it('destroys both textures', () => {
    const textures = createRenderTextures({ seed: 1, baker: createFakeTextureBaker() });
    destroyRenderTextures(textures);
    expect(textures.glowTexture.destroyed).toBe(true);
    expect(textures.vignetteTexture.destroyed).toBe(true);
  });
});

describe('the slice A bake specs', () => {
  it('describe a glow-sized disc fading to clear and a vignette square clear inside the radius fraction', () => {
    expect(SOFT_DISC_BAKE.sizePx).toBe(GLOW_TEXTURE_PX);
    expect(SOFT_DISC_BAKE.shape).toBe(RADIAL_BAKE_SHAPE.disc);
    expect(SOFT_DISC_BAKE.stops[0]?.alpha).toBe(1);
    expect(SOFT_DISC_BAKE.stops.at(-1)?.alpha).toBe(0);
    expect(VIGNETTE_BAKE.sizePx).toBe(VIGNETTE_TEXTURE_PX);
    expect(VIGNETTE_BAKE.shape).toBe(RADIAL_BAKE_SHAPE.square);
    expect(VIGNETTE_BAKE.stops.map((stop) => stop.offset)).toEqual([0, VIGNETTE_RADIUS_FRACTION, 1]);
    expect(VIGNETTE_BAKE.stops.at(-1)?.alpha).toBe(VIGNETTE_ALPHA);
  });
});
