import { describe, expect, it } from 'vitest';
import { DNA_TAGS } from '@evolution/shared';
import { createFakeTextureBaker, createTestRenderTextures } from '../../../testing/fake-pixi-app';
import {
  FIELD_TEXTURE_PX,
  GLOW_TEXTURE_PX,
  NOISE_STRIP_ROWS,
  NOISE_STRIP_WIDTH,
  NOISE_TILE_SIZE_PX,
  ORGANELLE_KIND,
  VIGNETTE_ALPHA,
  VIGNETTE_RADIUS_FRACTION,
  VIGNETTE_TEXTURE_PX,
} from './constants';
import { GLOW_SPRITE } from './textures/glow-atlas';
import { MOTE_SPRITE } from './textures/mote-atlas';
import { RADIAL_BAKE_SHAPE, SOFT_DISC_BAKE, VIGNETTE_BAKE, destroyRenderTextures } from './render-textures';

describe('createRenderTextures', () => {
  it('bakes the soft disc then the vignette through the radial path', () => {
    const baker = createFakeTextureBaker();
    const textures = createTestRenderTextures({ seed: 7, baker });
    expect(baker.bakedSpecs).toEqual([SOFT_DISC_BAKE, VIGNETTE_BAKE]);
    expect(textures.seed).toBe(7);
    expect(textures.glowTexture).not.toBe(textures.vignetteTexture);
  });

  it('bakes the dish field, the vent, the glow, mote and organelle atlases on canvases and turns each into a texture', () => {
    const baker = createFakeTextureBaker();
    const gelPatches = [{ x: 100, y: -200, radius: 350 }];
    const textures = createTestRenderTextures({ seed: 7, baker, gelPatches });
    expect(baker.bakedCanvases[0]!.width).toBe(FIELD_TEXTURE_PX);
    expect(textures.dishField.canvas).toBe(baker.bakedCanvases[0]);
    expect(textures.vent.canvas).toBe(baker.bakedCanvases[1]);
    expect(textures.vent.halfExtentWu).toBeGreaterThan(0);
    expect(Object.keys(textures.glow).sort()).toEqual(Object.values(GLOW_SPRITE).sort());
    expect(Object.keys(textures.motes.full).sort()).toEqual(Object.values(MOTE_SPRITE).sort());
    expect(Object.keys(textures.motes.small).sort()).toEqual(Object.values(MOTE_SPRITE).sort());
    expect(Object.keys(textures.motes.fragments).sort()).toEqual([...DNA_TAGS].sort());
    expect(Object.keys(textures.organelles).sort()).toEqual(Object.values(ORGANELLE_KIND).sort());
    expect(textures.organelles.nucleus.widthRadii).toBeGreaterThan(0);
    expect(baker.texturedBakes).toHaveLength(baker.bakedCanvases.length);
    expect(new Set(baker.texturedBakes).size).toBe(baker.bakedCanvases.length);
  });

  it('uploads the noise strip and tile as data textures of their sizes', () => {
    const textures = createTestRenderTextures({ seed: 7 });
    expect([textures.stripTexture.width, textures.stripTexture.height]).toEqual([NOISE_STRIP_WIDTH, NOISE_STRIP_ROWS]);
    expect([textures.tileTexture.width, textures.tileTexture.height]).toEqual([NOISE_TILE_SIZE_PX, NOISE_TILE_SIZE_PX]);
    expect(textures.strip.rows).toBe(NOISE_STRIP_ROWS);
    expect(textures.stripTexture.style.scaleMode).toBe('nearest');
    expect(textures.tileTexture.style.addressMode).toBe('repeat');
  });

  it('forks the cosmetic stream from the seed, so the same seed draws the same values', () => {
    const first = createTestRenderTextures({ seed: 42 });
    const second = createTestRenderTextures({ seed: 42 });
    const other = createTestRenderTextures({ seed: 43 });
    expect(first.cosmetic.nextFloat()).toBe(second.cosmetic.nextFloat());
    expect(first.cosmetic.nextFloat()).not.toBe(other.cosmetic.nextFloat());
    expect(first.strip.bytes).toEqual(second.strip.bytes);
    expect(first.strip.bytes).not.toEqual(other.strip.bytes);
  });

  it('destroys every texture', () => {
    const textures = createTestRenderTextures({ seed: 1 });
    destroyRenderTextures(textures);
    expect(textures.glowTexture.destroyed).toBe(true);
    expect(textures.vignetteTexture.destroyed).toBe(true);
    expect(textures.dishTexture.destroyed).toBe(true);
    expect(textures.ventTexture.destroyed).toBe(true);
    expect(textures.glow.ring.destroyed).toBe(true);
    expect(textures.motes.small.algae.destroyed).toBe(true);
    expect(textures.motes.fragments.motile.destroyed).toBe(true);
    expect(textures.organelles.lipid.texture.destroyed).toBe(true);
    expect(textures.stripTexture.destroyed).toBe(true);
    expect(textures.tileTexture.destroyed).toBe(true);
  });
});

describe('the radial bake specs', () => {
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
