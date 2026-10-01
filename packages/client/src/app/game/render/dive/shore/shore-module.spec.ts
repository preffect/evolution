// The shore's lazily loaded entry (docs/rendering/opening-dive.md §4): its land and tiles are made once a page, its
// coast is fresh for each dive, and the mockup reads its tiles by name.

import { describe, expect, it } from 'vitest';
import { createFakePixiApp } from '../../../../../testing/fake-pixi-app';
import { TEST_SHORE_RINGS } from '../../../../../testing/shore-paint-builder';
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

  it('makes the band on the shore’s own app', () => {
    const parts = createShoreParts(TEST_SHORE_RINGS, document);
    const pixi = createFakePixiApp();
    const band = parts.createBand(pixi, 1);
    expect(band.canvas).toBe(pixi.canvas);
    band.destroy();
  });
});
