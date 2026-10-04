// The shore's lazily loaded entry (docs/rendering/opening-dive.md §4): its land and tiles are made once a page and
// shared with the kelp, and each dive gets its own forest test.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecordingWorker, TwoDimensionalCanvas, fakeBitmap } from '../../../../../testing/fake-shore-bake';
import { createFakeShoreCanvasFactory } from '../../../../../testing/fake-shore-canvas';
import { createFakePixiApp } from '../../../../../testing/fake-pixi-app';
import { TEST_SHORE_RINGS } from '../../../../../testing/shore-paint-builder';
import { SHORE_BAKE_MESSAGE } from './shore-bake-messages';
import { createShoreParts } from './shore-module';

describe('createShoreParts', () => {
  it('keeps one land, tile set and canvas factory for the page and gives each dive its own forest test', () => {
    const first = createShoreParts(TEST_SHORE_RINGS, document);
    const second = createShoreParts(TEST_SHORE_RINGS, document);
    expect(second.tiles).toBe(first.tiles);
    expect(second.land).toBe(first.land);
    expect(second.factory).toBe(first.factory);
    expect(second.forest).not.toBe(first.forest);
  });

  it('makes the band, its shader warmed up through the dive’s app', () => {
    const parts = createShoreParts(TEST_SHORE_RINGS, document);
    const pixi = createFakePixiApp();
    const band = parts.createBand((container, target) => pixi.renderToTexture(container, target), 1);
    expect(pixi.textureRenders.map((render) => render.container)).toEqual([band.view]);
    band.destroy();
  });

  describe('the bake worker', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      RecordingWorker.made = [];
    });

    it('gives each band a worker where the page can bake offscreen, opened with its tiles, ended with the band', async () => {
      vi.stubGlobal('Worker', RecordingWorker);
      vi.stubGlobal('OffscreenCanvas', TwoDimensionalCanvas);
      const toBitmap = vi.fn(() => Promise.resolve(fakeBitmap()));
      vi.stubGlobal('createImageBitmap', toBitmap);
      const parts = createShoreParts(TEST_SHORE_RINGS, document);
      const baked = createFakeShoreCanvasFactory().create(4, 4);
      parts.tiles.adopt('grain', baked, [0, 0, 0, 1]);
      const pixi = createFakePixiApp();
      const band = parts.createBand((container, target) => pixi.renderToTexture(container, target), 1);
      const [worker] = RecordingWorker.made;
      expect(RecordingWorker.made).toHaveLength(1);
      await vi.waitFor(() =>
        expect(worker!.posted.map((posted) => posted.message.type)).toEqual([SHORE_BAKE_MESSAGE.open]),
      );
      expect(toBitmap).toHaveBeenCalledWith(baked.image);
      band.destroy();
      expect(worker!.isTerminated).toBe(true);
    });

    it('makes a band with no worker for a document with no window', () => {
      vi.stubGlobal('Worker', RecordingWorker);
      vi.stubGlobal('OffscreenCanvas', TwoDimensionalCanvas);
      const parts = createShoreParts(TEST_SHORE_RINGS, document.implementation.createHTMLDocument());
      const pixi = createFakePixiApp();
      const band = parts.createBand((container, target) => pixi.renderToTexture(container, target), 1);
      expect(RecordingWorker.made).toEqual([]);
      band.destroy();
    });
  });
});
