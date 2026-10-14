// What lies on the shore (docs/rendering/opening-dive.md §4): sand coves away from the focus, driftwood along the top
// of the rock band, tide pools, and boulders scattered near the coast, each where the world's hash puts it.

import { describe, expect, it } from 'vitest';
import { SHORE_BOULDER_SCATTER } from '../../constants/dive-shore-boulders';
import { SHORE_FIXED_POOL, SHORE_FOCAL_ROCK } from '../../constants/dive-shore-objects';
import { testShorePaint } from '../../../../../testing/shore-paint-builder';
import { boulderPlace, drawBoulder } from './shore-boulder';
import { drawBoulders, shoreBoulders } from './shore-boulders';
import { drawPools } from './shore-pools';
import { poolPath, rockPath } from './shore-shapes';
import { drawBeaches, drawDriftwood } from './shore-shore-life';

describe('the shapes', () => {
  it('close a smooth blob through every point, the same for the same seed', () => {
    const first = testShorePaint(1);
    const second = testShorePaint(1);
    rockPath(first.context, { x: 0, y: 0, radius: 1, seed: 5, squash: 0.8 });
    rockPath(second.context, { x: 0, y: 0, radius: 1, seed: 5, squash: 0.8 });
    expect(first.context.calls).toEqual(second.context.calls);
    expect(first.context.count('closePath')).toBe(1);
    poolPath(first.context, { x: 0, y: 0, radius: 1, seed: 5, squash: 0.6 });
    expect(first.context.count('quadraticCurveTo')).toBeGreaterThan(20);
  });
});

describe('shoreBoulders', () => {
  it('scatters them back to front, never on the focal rock or the hand-placed pool', () => {
    const boulders = shoreBoulders(testShorePaint(1.5));
    expect(boulders.length).toBeGreaterThan(0);
    for (let index = 1; index < boulders.length; index += 1)
      expect(boulders[index]!.y).toBeGreaterThanOrEqual(boulders[index - 1]!.y);
    for (const boulder of boulders) {
      expect(Math.hypot(boulder.x - SHORE_FOCAL_ROCK.x, boulder.y - SHORE_FOCAL_ROCK.y)).toBeGreaterThanOrEqual(
        SHORE_BOULDER_SCATTER.clearOfRockM,
      );
      expect(Math.hypot((boulder.x - SHORE_FIXED_POOL.x) / 1.3, boulder.y - SHORE_FIXED_POOL.y)).toBeGreaterThanOrEqual(
        5,
      );
    }
  });

  it('draws each one and answers them, for the stones the live sea keeps off', () => {
    const paint = testShorePaint(1.5);
    const drawn = drawBoulders(paint);
    expect(drawn).toEqual(shoreBoulders(testShorePaint(1.5)));
    expect(paint.context.gradients.some((gradient) => gradient.kind === 'radial')).toBe(true);
  });
});

describe('drawBoulder', () => {
  it('skips a stone under 1.5 px, and adds its surface, joints and sheen close in', () => {
    const far = testShorePaint(3);
    drawBoulder(far, { x: 0, y: 0, radius: 0.2, seed: 1, heightM: 2 });
    expect(far.context.ops).toEqual([]);
    const close = testShorePaint(-0.5);
    drawBoulder(close, { x: 0, y: 0, radius: 0.5, seed: 1, heightM: 0.2 }, true);
    expect(close.context.count('clip')).toBeGreaterThanOrEqual(3);
    expect(boulderPlace({ x: 0, y: 0, radius: 1, seed: 2, heightM: 0 }).squash).toBeGreaterThanOrEqual(0.8);
  });
});

describe('drawPools', () => {
  it('draws the hand-placed pool and the pools up the shore, each rim, crust, water and glint', () => {
    const paint = testShorePaint(1.5);
    drawPools(paint);
    expect(paint.context.count('ellipse')).toBeGreaterThan(0);
    expect(paint.context.globalAlpha).toBe(1);
  });
});

describe('the upper shore', () => {
  it('lays no beach within 350 m of the focus', () => {
    const paint = testShorePaint(1.5);
    drawBeaches(paint);
    expect(paint.context.ops).toEqual([]);
  });

  it('throws driftwood up along the top of the rock band, at the band’s fade', () => {
    const paint = testShorePaint(2.3);
    drawDriftwood(paint);
    expect(paint.context.globalAlpha).toBe(1);
    expect(paint.context.count('roundRect')).toBe(paint.context.count('rotate'));
  });
});
