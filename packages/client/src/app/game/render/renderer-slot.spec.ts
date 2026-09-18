import { describe, expect, it } from 'vitest';
import { TEST_NOISE_TILE_SIZE_PX, createFakePixiApp, createFakeTextureBaker } from '../../../testing/fake-pixi-app';
import { UNTIMED_STAGES } from './bench/render-stage-timer';
import { RendererSlot } from './renderer-slot';

const DEVICE_PIXEL_RATIO = 1;

function buildOptions(baker: ReturnType<typeof createFakeTextureBaker>, seed: number) {
  return {
    seed,
    baker,
    gelPatches: [],
    devicePixelRatio: DEVICE_PIXEL_RATIO,
    noiseTileSizePx: TEST_NOISE_TILE_SIZE_PX,
  };
}

describe('RendererSlot', () => {
  it('builds a renderer over fresh textures, replaces it on the next build and empties on dispose', () => {
    const pixi = createFakePixiApp();
    const slot = new RendererSlot();
    expect(slot.current).toBeNull();
    const options = buildOptions(pixi.textures, 3);
    const first = slot.build(pixi.stage, pixi.screen, options, UNTIMED_STAGES);
    expect(slot.current).toBe(first);
    expect(first.seed).toBe(3);
    const seededBakes = pixi.textures.texturedBakes.length;
    const second = slot.build(pixi.stage, pixi.screen, { ...options, seed: 4 }, UNTIMED_STAGES);
    expect(second).not.toBe(first);
    expect(second.seed).toBe(4);
    // The seeded half is re-baked: the dish field, the vent and the organelles all go through the baker again.
    expect(pixi.textures.texturedBakes.length).toBeGreaterThan(seededBakes);
    expect(pixi.stage.children).toHaveLength(2);
    slot.dispose();
    expect(slot.current).toBeNull();
    expect(pixi.stage.children).toHaveLength(0);
    slot.dispose();
  });

  it('keeps the seed-independent half across a rebuild: no second radial bake, no second font install (#442)', () => {
    const pixi = createFakePixiApp();
    const slot = new RendererSlot();
    const options = buildOptions(pixi.textures, 3);
    const first = slot.build(pixi.stage, pixi.screen, options, UNTIMED_STAGES);
    const radialBakes = pixi.textures.bakedSpecs.length;
    const fontInstalls = pixi.textures.installedFonts.length;
    expect(radialBakes).toBeGreaterThan(0);
    expect(fontInstalls).toBeGreaterThan(0);
    const keptIndicators = first.indicatorTextures;

    const second = slot.build(pixi.stage, pixi.screen, { ...options, seed: 4 }, UNTIMED_STAGES);

    expect(pixi.textures.bakedSpecs).toHaveLength(radialBakes);
    expect(pixi.textures.installedFonts).toHaveLength(fontInstalls);
    expect(pixi.textures.uninstalledFonts).toHaveLength(0);
    // Kept, not re-baked and not destroyed: the new renderer draws the very same indicator bundle.
    expect(second.indicatorTextures).toBe(keptIndicators);
    expect(keptIndicators.labelPill.texture.destroyed).toBe(false);
  });

  it('re-bakes the kept half when the baker or the device pixel ratio changes', () => {
    const pixi = createFakePixiApp();
    const slot = new RendererSlot();
    const options = buildOptions(pixi.textures, 3);
    slot.build(pixi.stage, pixi.screen, options, UNTIMED_STAGES);
    const radialBakes = pixi.textures.bakedSpecs.length;

    slot.build(pixi.stage, pixi.screen, { ...options, devicePixelRatio: 2 }, UNTIMED_STAGES);
    expect(pixi.textures.bakedSpecs).toHaveLength(radialBakes * 2);
    expect(pixi.textures.uninstalledFonts.length).toBeGreaterThan(0);

    const otherBaker = createFakeTextureBaker();
    slot.build(pixi.stage, pixi.screen, { ...buildOptions(otherBaker, 3), devicePixelRatio: 2 }, UNTIMED_STAGES);
    expect(otherBaker.bakedSpecs).toHaveLength(radialBakes);
  });

  it('destroys the kept half on dispose', () => {
    const pixi = createFakePixiApp();
    const slot = new RendererSlot();
    const first = slot.build(pixi.stage, pixi.screen, buildOptions(pixi.textures, 3), UNTIMED_STAGES);
    const keptIndicators = first.indicatorTextures;

    slot.dispose();

    expect(pixi.textures.uninstalledFonts.length).toBeGreaterThan(0);
    expect(keptIndicators.labelPill.texture.destroyed).toBe(true);
  });
});
