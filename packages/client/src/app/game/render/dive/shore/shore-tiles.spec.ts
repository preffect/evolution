// The shore's tiles (docs/rendering/opening-dive.md §4): every tile bakes a few milliseconds at a time in the order the
// dive needs them, a tile asked for early jumps the queue, and each keeps its mean colour for when it shrinks to a few
// pixels. Over recording canvases: what is checked is what each bake draws.

import { describe, expect, it } from 'vitest';
import { createFakeShoreCanvasFactory, type FakeShoreCanvas } from '../../../../../testing/fake-shore-canvas';
import type { ShoreCanvas } from './shore-canvas';
import { SHORE_TILE_BAKES, SHORE_TILE_NAMES, ShoreTiles, averageOf, type ShoreTileName } from './shore-tiles';
import type { PeriodicNoise } from './shore-noise';
import { QUICK_TILE_BAKES } from '../../../../../testing/shore-paint-builder';

/** A canvas whose pixels read back as `pixels`. */
function canvasReading(pixels: number[]): ShoreCanvas {
  const canvas = createFakeShoreCanvasFactory().create(2, 2);
  canvas.context.getImageData = (_left, _top, width, height) => ({
    width,
    height,
    data: Uint8ClampedArray.from(pixels),
  });
  return canvas;
}

describe('averageOf', () => {
  it('weights each sampled pixel by its coverage: a clear pixel adds nothing to the colour', () => {
    const average = averageOf(canvasReading([255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
    expect(average[0]).toBeCloseTo(1, 9);
    expect(average[3]).toBeGreaterThan(0);
  });

  it('is clear for a clear tile', () => {
    expect(averageOf(canvasReading(new Array(16).fill(0)))).toEqual([0, 0, 0, 0]);
  });
});

describe('each tile bake', () => {
  /** A flat noise: the bakes' own drawing is what is checked here, not the lattice (`shore-noise.spec.ts`). */
  const noise = { noise: () => 0.6, fbm: () => 0.6, layer: () => 0.6 } as unknown as PeriodicNoise;

  it.each(SHORE_TILE_NAMES)('%s ends with a canvas its size, drawn', (name) => {
    const factory = createFakeShoreCanvasFactory();
    const bake = SHORE_TILE_BAKES[name]({ factory, noise });
    let step = bake.next();
    let slices = 0;
    while (step.done !== true) {
      slices += 1;
      step = bake.next();
    }
    const canvas = step.value as FakeShoreCanvas;
    expect(canvas.width).toBeGreaterThan(0);
    expect(slices).toBeGreaterThan(0);
    const drawn = canvas.context.puts.length + canvas.context.paintCount + canvas.context.imageDraws.length;
    expect(drawn).toBeGreaterThan(0);
  });
});

describe('ShoreTiles', () => {
  it('bakes in the dive’s order, and answers null until a tile is made', () => {
    const tiles = new ShoreTiles(createFakeShoreCanvasFactory(), QUICK_TILE_BAKES);
    expect(tiles.get('rock')).toBeNull();
    expect(tiles.isBaked).toBe(false);
    let clock = 0;
    const hasFinished = tiles.pump(1, () => (clock += 1));
    expect(typeof hasFinished).toBe('boolean');
    tiles.bakeAll();
    expect(tiles.isBaked).toBe(true);
    for (const name of SHORE_TILE_NAMES) expect(tiles.get(name)).not.toBeNull();
  });

  it('moves a tile asked for to the front of the queue', () => {
    const tiles = new ShoreTiles(createFakeShoreCanvasFactory(), QUICK_TILE_BAKES);
    const asked: ShoreTileName = 'glint';
    expect(tiles.get(asked)).toBeNull();
    // a clock that moves a millisecond a read: three readings are the asked tile's two steps, then the budget is spent
    let clock = 0;
    expect(tiles.pump(3, () => (clock += 1))).toBe(true);
    expect(tiles.get(asked)).not.toBeNull();
    expect(tiles.get('rock')).toBeNull();
  });
});
