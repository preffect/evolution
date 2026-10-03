// What the kelp bakes once a page (docs/rendering/opening-dive.md §4): the blade's grain tile, the focal rock's outline
// and the coast round it as signed distances, and the beads, stepped a few milliseconds at a time, the real bakes over
// the shore's test land on recording canvases; and the nonzero rule that keeps the stipe's dry run over the rock.

import { describe, expect, it } from 'vitest';
import { KELP_ROCK_DISTANCE, KELP_SEA_DISTANCE } from '../../constants/dive-kelp';
import { KELP_BLADE_TILE } from '../../constants/dive-kelp-drop';
import { createFakeShoreCanvasFactory, type FakeShoreCanvas } from '../../../../../testing/fake-shore-canvas';
import { KELP_BAKE_TEST_TIMEOUT_MS, quickKelpBake } from '../../../../../testing/kelp-builder';
import { TEST_SHORE_LAND, TEST_SHORE_RINGS } from '../../../../../testing/shore-paint-builder';
import { landRingsOf } from '../shore/shore-coast-rings';
import { decodeSignedDistance } from '../planet/signed-distance';
import { KelpBakes, focalRockPlace, isRockKeptOnLand, kelpBaker } from './kelp-bakes';
import type { KelpDistanceBake } from './kelp-outline';

/** The test land's coast ring alone, without the far frame that sets the data's box (which the nonzero rule fills). */
const COAST_ONLY = landRingsOf([TEST_SHORE_RINGS[0]!]);

/** The bake's signed distance at `(x, y)` in metres (+ inside). */
function metresAt(bake: KelpDistanceBake, x: number, y: number): number {
  const column = Math.floor((x - bake.box[0]) / bake.metresPerTexel);
  const row = Math.floor((y - bake.box[1]) / bake.metresPerTexel);
  return decodeSignedDistance(bake.data, row * bake.width + column) * bake.metresPerTexel;
}

describe('KelpBakes', () => {
  it(
    'bakes the tile, the rock, the sea and the beads in many short steps, on the dive’s clock',
    () => {
      const factory = createFakeShoreCanvasFactory();
      const bakes = new KelpBakes({ land: COAST_ONLY, factory });
      // a clock that ticks a millisecond each read: a budget of 2 runs one step
      let clock = 0;
      const ticking = (): number => (clock += 1);
      let steps = 0;
      while (!bakes.isBaked) {
        bakes.pump(2, ticking);
        steps += 1;
      }
      expect(steps).toBeGreaterThan(100);
      const baked = bakes.baked!;
      const tile = baked.bladeTile as FakeShoreCanvas;
      expect([tile.width, tile.height]).toEqual([KELP_BLADE_TILE.sizePx, KELP_BLADE_TILE.sizePx]);
      expect(tile.context.puts).toHaveLength(1);
      expect(tile.context.puts[0]!.data[3]).toBe(KELP_BLADE_TILE.alpha);
      const place = focalRockPlace();
      expect(baked.rock.metresPerTexel).toBe(KELP_ROCK_DISTANCE.metresPerTexel);
      expect(metresAt(baked.rock, place.x, place.y)).toBeGreaterThan(place.radius * 0.7);
      expect(metresAt(baked.rock, baked.rock.box[0] + 0.01, baked.rock.box[1] + 0.01)).toBeLessThan(0);
      expect(baked.sea.box).toEqual(KELP_SEA_DISTANCE.box);
      // the land lies north of the focus (inside its ring, filled by the nonzero rule as the shore fills it), the sea south
      expect(metresAt(baked.sea, 0, -2)).toBeGreaterThan(1);
      expect(metresAt(baked.sea, 0, 2)).toBeLessThan(-1);
      expect(baked.beads.length).toBeGreaterThan(0);
      expect(typeof baked.isRockOnLandKept).toBe('boolean');
    },
    KELP_BAKE_TEST_TIMEOUT_MS,
  );

  it('steps a stand-in bake until it lands, then idles', () => {
    const bakes = new KelpBakes({ land: TEST_SHORE_LAND, factory: createFakeShoreCanvasFactory() }, quickKelpBake(3));
    expect(bakes.baked).toBeNull();
    let clock = 0;
    const baker = kelpBaker(bakes, () => clock);
    // each step costs a millisecond: a budget of 2 runs two of them
    const ticking = (): number => (clock += 1);
    expect(kelpBaker(bakes, ticking).pumpBakes(2)).toBe(false);
    expect(baker.isBaked).toBe(false);
    expect(kelpBaker(bakes, ticking).pumpBakes(10)).toBe(true);
    expect(baker.isBaked).toBe(true);
    expect(bakes.baked!.beads).toHaveLength(1);
    expect(kelpBaker(bakes, ticking).pumpBakes(10)).toBe(false);
  });
});

describe('isRockKeptOnLand', () => {
  it('keeps the rock on the land where their windings add, and drops it where they cancel', () => {
    expect(isRockKeptOnLand(1, 5)).toBe(true);
    expect(isRockKeptOnLand(-1, -5)).toBe(true);
    expect(isRockKeptOnLand(1, -5)).toBe(false);
    expect(isRockKeptOnLand(-2, 5)).toBe(false);
    expect(isRockKeptOnLand(0, -5)).toBe(true);
  });
});
