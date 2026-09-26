import { describe, expect, it, vi } from 'vitest';
import {
  TEST_NOISE_TILE_SIZE_PX,
  createFakePixiApp,
  createFakeTextureBaker,
  type FakeTextureBaker,
} from '../../../testing/fake-pixi-app';
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

  it('destroys the seeded half a rebuild replaces, and only that half (#442)', () => {
    const pixi = createFakePixiApp();
    const slot = new RendererSlot();
    const options = buildOptions(pixi.textures, 3);
    slot.build(pixi.stage, pixi.screen, options, UNTIMED_STAGES);
    const afterFirstBuild = pixi.textures.madeTextures.length;

    slot.build(pixi.stage, pixi.screen, { ...options, seed: 4 }, UNTIMED_STAGES);

    // A rebuild bakes the seeded half and nothing else, so its own texture count taken back from the end of
    // the first build is exactly the first build's seeded half; everything before that is the shared half.
    const secondSeeded = pixi.textures.madeTextures.slice(afterFirstBuild);
    expect(secondSeeded.length).toBeGreaterThan(0);
    const sharedEnd = afterFirstBuild - secondSeeded.length;
    const firstSeeded = pixi.textures.madeTextures.slice(sharedEnd, afterFirstBuild);
    const shared = pixi.textures.madeTextures.slice(0, sharedEnd);
    expect(shared.length).toBeGreaterThan(0);
    // The dish field, the vent and the organelle atlas are the largest textures in the bundle: a rebuild that
    // dropped its predecessor without destroying it would leak all of them at every round change.
    expect(firstSeeded.map((texture) => texture.destroyed)).toEqual(firstSeeded.map(() => true));
    expect(shared.map((texture) => texture.destroyed)).toEqual(shared.map(() => false));
    expect(secondSeeded.map((texture) => texture.destroyed)).toEqual(secondSeeded.map(() => false));
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

  it('lets go of the kept half before re-baking it, so a bake that throws leaves nothing installed (#442)', () => {
    const pixi = createFakePixiApp();
    const slot = new RendererSlot();
    const options = buildOptions(pixi.textures, 3);
    slot.build(pixi.stage, pixi.screen, options, UNTIMED_STAGES);
    const failingBaker: FakeTextureBaker = {
      ...pixi.textures,
      bakeRadial: () => {
        throw new Error('the GL context went away mid-bake');
      },
    };

    // A changed device pixel ratio sends the slot back to the baker, and this one fails part way through.
    expect(() =>
      slot.build(pixi.stage, pixi.screen, { ...buildOptions(failingBaker, 3), devicePixelRatio: 2 }, UNTIMED_STAGES),
    ).toThrow();

    // The failed re-bake had already destroyed the first bundle. If the slot were still holding it, this
    // build would take the same-baker fast path and hand a new renderer textures that are already destroyed.
    const rebuilt = slot.build(pixi.stage, pixi.screen, options, UNTIMED_STAGES);
    expect(rebuilt.indicatorTextures.labelPill.texture.destroyed).toBe(false);
  });

  it('destroys a renderer before the textures its shaders bind, on a rebuild and on dispose (#468)', () => {
    const pixi = createFakePixiApp();
    const slot = new RendererSlot();
    const options = buildOptions(pixi.textures, 3);
    // The cell mesh's shaders bind the strip, the tile and the palette as `texelFetch` tables: a source destroyed
    // while a live shader still binds it logs Pixi's `[BindGroup] … destroyed while still bound` warning.
    const boundAtDestroy = (seed: number, teardown: () => void): boolean[] => {
      const build = slot.beginBuild(pixi.stage, pixi.screen, { ...options, seed }, UNTIMED_STAGES);
      while (!build.advance());
      const { renderer, textures } = build.staged!;
      build.commit();
      const bound = [textures.stripTexture, textures.tileTexture, textures.paletteTexture];
      let destroyedAtRendererDestroy: boolean[] = [];
      const destroyRenderer = renderer.destroy.bind(renderer);
      vi.spyOn(renderer, 'destroy').mockImplementation(() => {
        destroyedAtRendererDestroy = bound.map((source) => source.destroyed);
        destroyRenderer();
      });
      teardown();
      return destroyedAtRendererDestroy;
    };

    const rebuild = () => slot.build(pixi.stage, pixi.screen, { ...options, seed: 4 }, UNTIMED_STAGES);
    expect(boundAtDestroy(3, rebuild), 'a rebuild destroyed a bound texture first').toEqual([false, false, false]);
    expect(
      boundAtDestroy(5, () => slot.dispose()),
      'dispose destroyed a bound texture first',
    ).toEqual([false, false, false]);
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

  it('stages a build one bake per advance, off the stage, and swaps in only on commit (#479, #603)', () => {
    const pixi = createFakePixiApp();
    const slot = new RendererSlot();
    const options = buildOptions(pixi.textures, 3);
    const build = slot.beginBuild(pixi.stage, pixi.screen, options, UNTIMED_STAGES);
    let advances = 1;
    build.advance();
    // The first advance ran exactly one bake: the light pool, and not yet a radial one.
    expect(pixi.textures.bakedSpecs).toHaveLength(0);
    while (!build.advance()) advances += 1;
    expect(advances).toBeGreaterThan(5);
    const staged = build.staged!;
    expect(slot.current, 'a built renderer went current before its commit').toBeNull();
    expect(pixi.stage.children, 'a built renderer is on the stage before its commit').toHaveLength(0);
    expect(staged.container.children).toHaveLength(2);
    const stagedOrder = [...staged.container.children];
    const built = build.commit();
    expect(built).toBe(staged.renderer);
    expect(slot.current).toBe(built);
    // In the order they were staged: the world root under the screen root, or the opaque field hides the vignette
    // (#687; Pixi's `removeChildren` answers last first). Compared as staged indices: a failing diff of two scene
    // graphs took minutes to print.
    expect(pixi.stage.children.map((root) => stagedOrder.indexOf(root))).toEqual(
      stagedOrder.map((_root, index) => index),
    );

    const radialBakes = pixi.textures.bakedSpecs.length;
    const rebuild = slot.beginBuild(pixi.stage, pixi.screen, { ...options, seed: 4 }, UNTIMED_STAGES);
    rebuild.advance();
    expect(slot.current, 'the old renderer must keep drawing while the rematch bakes').toBe(built);
    const rebuilt = rebuild.commit();
    expect(rebuilt.seed).toBe(4);
    expect(slot.current).toBe(rebuilt);
    expect(pixi.stage.children, 'the old renderer’s layers were left on the stage').toHaveLength(2);
    expect(pixi.textures.bakedSpecs, 'the kept half was baked again').toHaveLength(radialBakes);
    slot.dispose();
  });

  it('bakes the same textures staged as whole: one bake of each, the same canvases in the same order', () => {
    const whole = createFakePixiApp();
    const staged = createFakePixiApp();
    const wholeSlot = new RendererSlot();
    const stagedSlot = new RendererSlot();
    wholeSlot.build(whole.stage, whole.screen, buildOptions(whole.textures, 7), UNTIMED_STAGES);
    const build = stagedSlot.beginBuild(staged.stage, staged.screen, buildOptions(staged.textures, 7), UNTIMED_STAGES);
    while (!build.advance());
    build.commit();
    expect(staged.textures.bakedSpecs).toEqual(whole.textures.bakedSpecs);
    expect(staged.textures.bakedCanvases.map((canvas) => [canvas.width, canvas.height])).toEqual(
      whole.textures.bakedCanvases.map((canvas) => [canvas.width, canvas.height]),
    );
    // Font names are unique per bundle (the BitmapFont cache is process-wide); what is installed is the same.
    const fontsOf = (installs: typeof whole.textures.installedFonts) =>
      installs.map((install) => [install.style, install.chars, install.resolution]);
    expect(fontsOf(staged.textures.installedFonts)).toEqual(fontsOf(whole.textures.installedFonts));
    wholeSlot.dispose();
    stagedSlot.dispose();
  });
});
