// The kelp band's textures (docs/rendering/opening-dive.md §4): none until every shore tile it reads has baked; then
// its own bakes and the tiles as GPU sources, the far tiles' and the foam's means beside them, all given back at once.

import { describe, expect, it } from 'vitest';
import { createFakeShoreCanvasFactory } from '../../../../../testing/fake-shore-canvas';
import { quickKelpBake } from '../../../../../testing/kelp-builder';
import { TEST_SHORE_LAND, bakedTestTiles } from '../../../../../testing/shore-paint-builder';
import { KELP_SHORE_TILES, kelpTextures, releaseKelpTextures } from './kelp-textures';

function baked() {
  const steps = quickKelpBake(0)({ land: TEST_SHORE_LAND, factory: createFakeShoreCanvasFactory() });
  const step = steps.next();
  if (step.done !== true) throw new Error('the quick bake lands in one step');
  return step.value;
}

describe('kelpTextures', () => {
  it('makes none while one of the shore’s tiles it reads is still baking', () => {
    const tiles = bakedTestTiles();
    const missing = { ...tiles, get: (name: string) => (name === 'caustic' ? null : tiles.get(name as never)) };
    expect(kelpTextures(baked(), missing as never)).toBeNull();
  });

  it('makes a source for each of its bakes and tiles, keeps the means, and gives every one back', () => {
    const textures = kelpTextures(baked(), bakedTestTiles())!;
    expect(Object.keys(textures.tiles).sort()).toEqual([...KELP_SHORE_TILES].sort());
    expect(textures.means.foam).toEqual([0.5, 0.5, 0.5, 0.5]);
    expect(textures.rockDistance.width).toBe(2);
    const all = [textures.bladeTile, textures.rockDistance, textures.seaDistance, ...Object.values(textures.tiles)];
    expect(new Set(all).size).toBe(all.length);
    releaseKelpTextures(textures);
    for (const source of all) expect(source.destroyed).toBe(true);
  });
});
