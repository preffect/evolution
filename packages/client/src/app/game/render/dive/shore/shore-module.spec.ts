// The shore's lazily loaded entry (docs/rendering/opening-dive.md §4): its land and tiles are made once a page and
// shared with the kelp, and each dive gets its own forest test.

import { describe, expect, it } from 'vitest';
import { createFakePixiApp } from '../../../../../testing/fake-pixi-app';
import { TEST_SHORE_RINGS } from '../../../../../testing/shore-paint-builder';
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
});
