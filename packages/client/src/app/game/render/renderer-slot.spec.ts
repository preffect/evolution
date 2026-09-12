import { describe, expect, it } from 'vitest';
import { TEST_NOISE_TILE_SIZE_PX, createFakePixiApp } from '../../../testing/fake-pixi-app';
import { UNTIMED_STAGES } from './bench/render-stage-timer';
import { RendererSlot } from './renderer-slot';

describe('RendererSlot', () => {
  it('builds a renderer over fresh textures, replaces it on the next build and empties on dispose', () => {
    const pixi = createFakePixiApp();
    const slot = new RendererSlot();
    expect(slot.current).toBeNull();
    const options = {
      seed: 3,
      baker: pixi.textures,
      gelPatches: [],
      devicePixelRatio: 1,
      noiseTileSizePx: TEST_NOISE_TILE_SIZE_PX,
    };
    const first = slot.build(pixi.stage, pixi.screen, options, UNTIMED_STAGES);
    expect(slot.current).toBe(first);
    expect(first.seed).toBe(3);
    const bakes = pixi.bakedSpecs.length;
    const second = slot.build(pixi.stage, pixi.screen, { ...options, seed: 4 }, UNTIMED_STAGES);
    expect(second).not.toBe(first);
    expect(second.seed).toBe(4);
    expect(pixi.bakedSpecs.length).toBe(bakes * 2);
    expect(pixi.stage.children).toHaveLength(2);
    slot.dispose();
    expect(slot.current).toBeNull();
    expect(pixi.stage.children).toHaveLength(0);
    slot.dispose();
  });
});
