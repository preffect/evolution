// The shore's lazily loaded entry (docs/rendering/opening-dive.md §4): its land and tiles are made once a page, its
// coast is fresh for each dive, and the mockup reads its tiles by name.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecordingWorker, TwoDimensionalCanvas, fakeBitmap } from '../../../../../testing/fake-shore-bake';
import { createFakeShoreCanvasFactory } from '../../../../../testing/fake-shore-canvas';
import { createFakePixiApp } from '../../../../../testing/fake-pixi-app';
import { TEST_SHORE_RINGS } from '../../../../../testing/shore-paint-builder';
import { SHORE_BAKE_MESSAGE } from './shore-bake-messages';
import { createShoreParts } from './shore-module';

describe('createShoreParts', () => {
  it('keeps one tile set for the page and gives each dive its own coast', () => {
    const first = createShoreParts(TEST_SHORE_RINGS, document);
    const second = createShoreParts(TEST_SHORE_RINGS, document);
    expect(second.tiles).toBe(first.tiles);
    expect(second.coast).not.toBe(first.coast);
  });

  it('answers the mockup no tile for a name it does not bake, and none while a tile bakes', () => {
    const parts = createShoreParts(TEST_SHORE_RINGS, document);
    expect(parts.mockupTiles.get('blade')).toBeNull();
    expect(parts.mockupTiles.get('rock')).toBeNull();
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
