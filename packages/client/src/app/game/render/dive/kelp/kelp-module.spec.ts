// The kelp's lazily loaded entry (docs/rendering/opening-dive.md §4): its bakes are made once a page and pumped on each
// open dive's clock; its band is made on the dive's app, its programs warmed up through it.

import { describe, expect, it } from 'vitest';
import { createFakePixiApp } from '../../../../../testing/fake-pixi-app';
import { createFakeShoreCanvasFactory } from '../../../../../testing/fake-shore-canvas';
import { TEST_SHORE_LAND, bakedTestTiles } from '../../../../../testing/shore-paint-builder';
import type { ShoreTiles } from '../shore/shore-tiles';
import { createKelpParts } from './kelp-module';

const share = () => ({
  land: TEST_SHORE_LAND,
  tiles: bakedTestTiles() as ShoreTiles,
  factory: createFakeShoreCanvasFactory(),
});

describe('createKelpParts', () => {
  it('keeps one bake for the page, each open pumping it on its own clock', () => {
    const reads = { first: 0, second: 0 };
    const first = createKelpParts(share(), () => (reads.first += 1));
    const second = createKelpParts(share(), () => (reads.second += 1));
    second.bakes.pumpBakes(1);
    expect(reads.second).toBeGreaterThan(0);
    expect(reads.first).toBe(0);
    expect(first.bakes.isBaked).toBe(second.bakes.isBaked);
  });

  it('makes the band on the dive’s app, its programs warmed up through it', () => {
    const pixi = createFakePixiApp();
    const band = createKelpParts(share(), () => 0).createBand(
      (container, target) => pixi.renderToTexture(container, target),
      1,
    );
    expect(pixi.textureRenders.map((render) => render.container)).toEqual([band.view]);
    band.destroy();
  });
});
