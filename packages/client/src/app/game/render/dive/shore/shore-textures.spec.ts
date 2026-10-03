// The shore's bakes on the GPU (docs/rendering/opening-dive.md §4): a level's colour, distance grid, stones and water
// table become texture sources and are destroyed together; the sea's tiles become repeating sources once all have baked.

import { describe, expect, it } from 'vitest';
import { createFakeShoreCanvasFactory } from '../../../../../testing/fake-shore-canvas';
import { bakedTestTiles } from '../../../../../testing/shore-paint-builder';
import { shoreLevelView } from './shore-lod';
import type { ShoreSnapshot } from './shore-snapshot';
import { SHORE_LEVEL_UPLOADER, liveTileTextures, releaseTileTextures } from './shore-textures';

function snapshot(hasStones: boolean): ShoreSnapshot {
  const factory = createFakeShoreCanvasFactory();
  const canvas = (): HTMLCanvasElement => document.createElement('canvas');
  const colour = { ...factory.create(4, 4), image: canvas() };
  return {
    view: shoreLevelView(3, { width: 100, height: 60 }, 1),
    colour,
    sea: { width: 2, height: 2, cellsPerMetre: 0.5, bytes: new Uint8Array(16) },
    stones: hasStones ? { ...factory.create(2, 2), image: canvas() } : null,
    ramp: { bytes: new Uint8Array(12), entries: 3, stepM: 2 },
  };
}

describe('SHORE_LEVEL_UPLOADER', () => {
  it('makes a level’s sources, the stones only when the level has some, and destroys them all', () => {
    const level = SHORE_LEVEL_UPLOADER.upload(snapshot(true));
    expect(level.stones).not.toBeNull();
    expect(level.rampScale).toEqual({ entries: 3, stepM: 2 });
    expect(level.grid).toEqual({ width: 2, height: 2, cellsPerMetre: 0.5 });
    expect(level.distances.style.addressModeU).toBe('clamp-to-edge');
    let destroyed = 0;
    for (const source of [level.colour, level.distances, level.stones!, level.ramp])
      source.on('destroy', () => (destroyed += 1));
    SHORE_LEVEL_UPLOADER.release(level);
    expect(destroyed).toBe(4);
    expect(SHORE_LEVEL_UPLOADER.upload(snapshot(false)).stones).toBeNull();
  });
});

describe('liveTileTextures', () => {
  it('answers nothing until every sea tile has baked, then repeating sources and the foam’s mean colour', () => {
    expect(liveTileTextures({ get: () => null, isBaked: false })).toBeNull();
    const baked = bakedTestTiles();
    const tiles = {
      get: (name: Parameters<typeof baked.get>[0]) => {
        const tile = baked.get(name);
        return tile === null ? null : { ...tile, canvas: { ...tile.canvas, image: document.createElement('canvas') } };
      },
      isBaked: true,
    };
    const textures = liveTileTextures(tiles);
    expect(textures).not.toBeNull();
    expect(textures!.foamMean).toEqual([0.5, 0.5, 0.5, 0.5]);
    expect(textures!.caustic.style.addressModeU).toBe('repeat');
    releaseTileTextures(textures!);
  });
});
