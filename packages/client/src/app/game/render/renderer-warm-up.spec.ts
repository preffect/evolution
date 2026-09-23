import { describe, expect, it, vi } from 'vitest';
import { RENDER_STAGE } from '@evolution/shared';
import { TextureSource } from 'pixi.js';
import { TEST_NOISE_TILE_SIZE_PX, createFakePixiApp } from '../../../testing/fake-pixi-app';
import { UNTIMED_STAGES, type StageMeasurer } from './bench/render-stage-timer';
import { createRenderTextures, destroyRenderTextures } from './render-textures';
import { RendererSlot } from './renderer-slot';
import { MutableStageMeasurer, UPLOADS_PER_FRAME, WarmedRendererBuild, textureSourcesOf } from './renderer-warm-up';

function options(pixi: ReturnType<typeof createFakePixiApp>) {
  return {
    seed: 5,
    baker: pixi.textures,
    gelPatches: [],
    devicePixelRatio: 1,
    noiseTileSizePx: TEST_NOISE_TILE_SIZE_PX,
  };
}

describe('textureSourcesOf', () => {
  it('finds every source of a bundle once: the sprites’ and the data textures’ own', () => {
    const pixi = createFakePixiApp();
    const textures = createRenderTextures(options(pixi));
    const sources = textureSourcesOf(textures);
    expect(new Set(sources).size).toBe(sources.length);
    expect(sources).toContain(textures.paletteTexture);
    expect(sources).toContain(textures.tileTexture);
    expect(sources).toContain(textures.vignetteTexture.source);
    expect(sources).toContain(textures.motes.source);
    expect(sources).toContain(textures.indicators.labelPill.texture.source);
    expect(sources.every((source) => source instanceof TextureSource)).toBe(true);
    destroyRenderTextures(textures);
  });
});

describe('WarmedRendererBuild', () => {
  it('bakes, uploads a batch a frame, draws once, renders off screen once, then commits — never on stage before', () => {
    const pixi = createFakePixiApp();
    const slot = new RendererSlot();
    const drawOnce = vi.fn();
    const build = new WarmedRendererBuild(
      slot.beginBuild(pixi.stage, pixi.screen, options(pixi), UNTIMED_STAGES),
      pixi.warmUp,
      drawOnce,
    );
    const steps: string[] = [];
    let renderer = build.advance();
    while (renderer === null) {
      const uploads = pixi.warmUpCalls.uploads.length;
      const renders = pixi.warmUpCalls.offscreenRenders.length;
      const draws = drawOnce.mock.calls.length;
      renderer = build.advance();
      if (pixi.warmUpCalls.uploads.length > uploads) steps.push('upload');
      else if (drawOnce.mock.calls.length > draws) steps.push('draw');
      else if (pixi.warmUpCalls.offscreenRenders.length > renders) steps.push('render');
      else if (renderer === null) steps.push('bake');
      if (renderer === null) expect(slot.current, 'the renderer went current before its warm-up ended').toBeNull();
    }
    const firstUpload = steps.indexOf('upload');
    expect(steps.slice(0, firstUpload).every((step) => step === 'bake')).toBe(true);
    expect(steps.slice(-2)).toEqual(['draw', 'render']);
    const sources = pixi.warmUpCalls.uploads.length;
    expect(steps.filter((step) => step === 'upload')).toHaveLength(Math.ceil(sources / UPLOADS_PER_FRAME));
    expect(drawOnce).toHaveBeenCalledWith(renderer);
    expect(pixi.warmUpCalls.offscreenRenders[0]).not.toBe(pixi.stage);
    expect(slot.current).toBe(renderer);
    expect(pixi.stage.children).toHaveLength(2);
    slot.dispose();
  });

  it('finishes mid-build by committing at once, the warm-up skipped', () => {
    const pixi = createFakePixiApp();
    const slot = new RendererSlot();
    const build = new WarmedRendererBuild(
      slot.beginBuild(pixi.stage, pixi.screen, options(pixi), UNTIMED_STAGES),
      pixi.warmUp,
      vi.fn(),
    );
    build.advance();
    const renderer = build.finish();
    expect(slot.current).toBe(renderer);
    expect(pixi.warmUpCalls.uploads).toHaveLength(0);
    slot.dispose();
  });
});

describe('MutableStageMeasurer', () => {
  it('brackets through the inner measurer, and not at all while muted', () => {
    const inner: StageMeasurer = { measure: vi.fn((_stage, work) => work()), accrue: vi.fn((_stage, work) => work()) };
    const stages = new MutableStageMeasurer(inner);
    expect(stages.measure(RENDER_STAGE.cells, () => 1)).toBe(1);
    stages.accrue(RENDER_STAGE.net, () => 2);
    expect(inner.measure).toHaveBeenCalledTimes(1);
    expect(inner.accrue).toHaveBeenCalledTimes(1);
    stages.isMuted = true;
    expect(stages.measure(RENDER_STAGE.cells, () => 3)).toBe(3);
    stages.accrue(RENDER_STAGE.net, () => 4);
    expect(inner.measure).toHaveBeenCalledTimes(1);
    expect(inner.accrue).toHaveBeenCalledTimes(1);
  });
});
