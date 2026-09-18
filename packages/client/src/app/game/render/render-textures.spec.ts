import { describe, expect, it } from 'vitest';
import { DNA_TAGS, PLAYER_PALETTE_COUNT } from '@evolution/shared';
import { areBytesEqual } from '../../../testing/bytes';
import { fakeContextOf } from '../../../testing/fake-bake-canvas';
import {
  TEST_NOISE_TILE_SIZE_PX,
  createFakeTextureBaker,
  createTestRenderTextures,
} from '../../../testing/fake-pixi-app';
import {
  FIELD_TEXTURE_PX,
  LIGHT_POOL_TEXTURE_PX,
  NOISE_STRIP_ROWS,
  NOISE_STRIP_WIDTH,
  ORGANELLE_KIND,
  PALETTE_SHADE_COUNT,
} from './constants';
import { GLOW_SPRITE } from './textures/glow-atlas';
import { MOTE_SPRITE } from './textures/mote-atlas';
import { SOFT_DISC_BAKE, VIGNETTE_BAKE } from './textures/radial-bake';
import {
  createSeededRenderTextures,
  createSharedRenderTextures,
  destroyRenderTextures,
  destroySeededRenderTextures,
  destroySharedRenderTextures,
} from './render-textures';

describe('createRenderTextures', () => {
  it('bakes the soft disc then the vignette through the radial path', () => {
    const baker = createFakeTextureBaker();
    const textures = createTestRenderTextures({ seed: 7, baker });
    expect(baker.bakedSpecs).toEqual([SOFT_DISC_BAKE, VIGNETTE_BAKE]);
    expect(textures.seed).toBe(7);
    expect(textures.glowTexture).not.toBe(textures.vignetteTexture);
  });

  it('bakes the dish field, the vent, the light pool, the glow, mote and organelle atlases on canvases and turns each into a texture', () => {
    const baker = createFakeTextureBaker();
    const gelPatches = [{ x: 100, y: -200, radius: 350 }];
    const textures = createTestRenderTextures({ seed: 7, baker, gelPatches });
    expect(textures.dishField.canvas.width).toBe(FIELD_TEXTURE_PX);
    expect(baker.bakedCanvases).toContain(textures.dishField.canvas);
    expect(baker.bakedCanvases).toContain(textures.vent.canvas);
    expect(textures.vent.halfExtentWu).toBeGreaterThan(0);
    const lightPool = baker.bakedCanvases.find((canvas) => canvas.width === LIGHT_POOL_TEXTURE_PX);
    expect(lightPool?.height).toBe(LIGHT_POOL_TEXTURE_PX);
    expect(textures.lightPoolTexture).not.toBe(textures.ventTexture);
    expect(Object.keys(textures.glow).sort()).toEqual(Object.values(GLOW_SPRITE).sort());
    expect(Object.keys(textures.motes.full).sort()).toEqual(Object.values(MOTE_SPRITE).sort());
    expect(Object.keys(textures.motes.small).sort()).toEqual(Object.values(MOTE_SPRITE).sort());
    expect(Object.keys(textures.motes.fragments).sort()).toEqual([...DNA_TAGS].sort());
    // One source behind every mote and fragment frame: the food ParticleContainer's one texture (rendering/budget.md §6).
    const moteFrames = [
      ...Object.values(textures.motes.full),
      ...Object.values(textures.motes.small),
      ...Object.values(textures.motes.fragments),
      ...Object.values(textures.motes.rodGlint),
    ];
    expect(new Set(moteFrames.map((texture) => texture.source)).size).toBe(1);
    expect(moteFrames[0]!.source).toBe(textures.motes.source);
    expect(Object.keys(textures.organelles).sort()).toEqual(Object.values(ORGANELLE_KIND).sort());
    expect(textures.organelles.nucleus.widthRadii).toBeGreaterThan(0);
    expect(baker.texturedBakes).toHaveLength(baker.bakedCanvases.length);
    expect(new Set(baker.texturedBakes).size).toBe(baker.bakedCanvases.length);
  });

  it('uploads the noise strip and tile as data textures of their sizes, the tile at the size asked for', () => {
    const textures = createTestRenderTextures({ seed: 7 });
    expect([textures.stripTexture.width, textures.stripTexture.height]).toEqual([NOISE_STRIP_WIDTH, NOISE_STRIP_ROWS]);
    expect([textures.tileTexture.width, textures.tileTexture.height]).toEqual([
      TEST_NOISE_TILE_SIZE_PX,
      TEST_NOISE_TILE_SIZE_PX,
    ]);
    expect(textures.strip.rows).toBe(NOISE_STRIP_ROWS);
    expect(textures.stripTexture.style.scaleMode).toBe('nearest');
    expect(textures.tileTexture.style.addressMode).toBe('repeat');
    expect(textures.tileTexture.autoGenerateMipmaps).toBe(true);
    expect(textures.stripTexture.autoGenerateMipmaps).toBe(false);
    expect(textures.paletteTexture.autoGenerateMipmaps).toBe(false);
    expect([textures.paletteTexture.width, textures.paletteTexture.height]).toEqual([
      PALETTE_SHADE_COUNT,
      PLAYER_PALETTE_COUNT,
    ]);
    expect(textures.paletteTexture.style.scaleMode).toBe('nearest');
  });

  it('forks the cosmetic stream from the seed, so the same seed draws the same values', () => {
    const first = createTestRenderTextures({ seed: 42 });
    const second = createTestRenderTextures({ seed: 42 });
    const other = createTestRenderTextures({ seed: 43 });
    expect(first.cosmetic.nextFloat()).toBe(second.cosmetic.nextFloat());
    expect(first.cosmetic.nextFloat()).not.toBe(other.cosmetic.nextFloat());
    expect(areBytesEqual(first.strip.bytes, second.strip.bytes)).toBe(true);
    expect(areBytesEqual(first.strip.bytes, other.strip.bytes)).toBe(false);
  });

  it('destroys every texture', () => {
    const textures = createTestRenderTextures({ seed: 1 });
    destroyRenderTextures(textures);
    expect(textures.glowTexture.destroyed).toBe(true);
    expect(textures.vignetteTexture.destroyed).toBe(true);
    expect(textures.dishTexture.destroyed).toBe(true);
    expect(textures.ventTexture.destroyed).toBe(true);
    expect(textures.lightPoolTexture.destroyed).toBe(true);
    expect(textures.glow.ring.destroyed).toBe(true);
    expect(textures.motes.small.algae.destroyed).toBe(true);
    expect(textures.motes.fragments.motile.destroyed).toBe(true);
    expect(textures.motes.rodGlint.small.destroyed).toBe(true);
    expect(textures.motes.source.destroyed).toBe(true);
    expect(textures.organelles.lipid.texture.destroyed).toBe(true);
    expect(textures.stripTexture.destroyed).toBe(true);
    expect(textures.tileTexture.destroyed).toBe(true);
    expect(textures.paletteTexture.destroyed).toBe(true);
  });
});

describe('the two halves of the bundle (#442)', () => {
  const seededOptions = {
    seed: 42,
    // Not empty: this is what a rebuild has to carry through to the dish field, and an empty list would
    // let a `createRenderTextures` that forgot to forward it look identical to one that did.
    gelPatches: [{ x: 120, y: -80, radius: 300 }],
    devicePixelRatio: 1,
    noiseTileSizePx: TEST_NOISE_TILE_SIZE_PX,
  };

  /**
   * A rebuild builds the seeded half alone, so it must come out as the whole bundle's seeded half would.
   * That it *cannot* differ through the cosmetic stream is structural rather than lucky:
   * `fork(label)` seeds a child from the parent's **seed**, never its position
   * (`determinism/random-streams.md` §3), so no bake can move another's numbers whatever order they run in.
   * What this does catch is the composition — a `createRenderTextures` that hands the two halves different
   * inputs — which is why the strokes are compared with gel patches in play.
   */
  it('builds the seeded half the same whether it is built alone or as part of the whole bundle', () => {
    const whole = createTestRenderTextures({ ...seededOptions, baker: createFakeTextureBaker() });
    const seededOnly = createSeededRenderTextures({ ...seededOptions, baker: createFakeTextureBaker() });
    expect(areBytesEqual(whole.strip.bytes, seededOnly.strip.bytes)).toBe(true);
    expect(fakeContextOf(seededOnly.dishField.canvas).calls).toEqual(fakeContextOf(whole.dishField.canvas).calls);
    expect(fakeContextOf(seededOnly.vent.canvas).calls).toEqual(fakeContextOf(whole.vent.canvas).calls);
    expect(seededOnly.tileTexture.width).toBe(whole.tileTexture.width);
  });

  it('bakes the radials and the indicator fonts in the shared half only', () => {
    const sharedBaker = createFakeTextureBaker();
    createSharedRenderTextures(sharedBaker, seededOptions.devicePixelRatio);
    const seededBaker = createFakeTextureBaker();
    createSeededRenderTextures({ ...seededOptions, baker: seededBaker });
    expect(sharedBaker.bakedSpecs).toEqual([SOFT_DISC_BAKE, VIGNETTE_BAKE]);
    expect(sharedBaker.installedFonts.length).toBeGreaterThan(0);
    expect(seededBaker.bakedSpecs).toEqual([]);
    expect(seededBaker.installedFonts).toEqual([]);
  });

  it('destroys one half without touching the other, so a rebuild may keep the shared one', () => {
    const baker = createFakeTextureBaker();
    const shared = createSharedRenderTextures(baker, seededOptions.devicePixelRatio);
    const seeded = createSeededRenderTextures({ ...seededOptions, baker });

    destroySeededRenderTextures(seeded);
    expect(seeded.dishTexture.destroyed).toBe(true);
    expect(seeded.tileTexture.destroyed).toBe(true);
    expect(shared.vignetteTexture.destroyed).toBe(false);
    expect(shared.paletteTexture.destroyed).toBe(false);
    expect(baker.uninstalledFonts).toEqual([]);

    destroySharedRenderTextures(shared);
    expect(shared.vignetteTexture.destroyed).toBe(true);
    expect(shared.paletteTexture.destroyed).toBe(true);
    expect(baker.uninstalledFonts.length).toBeGreaterThan(0);
  });
});
