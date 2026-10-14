// @vitest-environment node
// The shore's noise (docs/rendering/opening-dive.md §4): the mockup's coordinate hash bit for bit (a stone sits where
// the mockup puts it), value noise between its lattice values, a periodic lattice that wraps, and a wrapping Voronoi.

import { describe, expect, it } from 'vitest';
import {
  PeriodicNoise,
  coordinateHash,
  mixHash,
  shoreRandom,
  square,
  valueNoise,
  wrappingVoronoi,
} from './shore-noise';

/** The mockup's `hash` and `mix32`, verbatim, to pin the port against. */
function mockupHash(x: number, y: number, key: number): number {
  let hash = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(key | 0, 2147483647);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}
function mockupMix32(value: number): number {
  let hash = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}

describe('coordinateHash and mixHash', () => {
  it('are the mockup’s, so every pool, boulder and kelp bed lands where the mockup put it', () => {
    for (const [x, y, key] of [
      [0, 0, 0],
      [3, -7, 141],
      [-120, 45, 231],
      [99999, -99999, 471],
    ] as const) {
      expect(coordinateHash(x, y, key)).toBe(mockupHash(x, y, key));
    }
    for (const value of [0, 1, 0x68e31da4, 0xffffffff, 123456789]) expect(mixHash(value)).toBe(mockupMix32(value));
  });

  it('stays in [0, 1)', () => {
    for (let index = -50; index < 50; index += 1) {
      const value = coordinateHash(index, index * 3, 7);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('valueNoise', () => {
  it('passes through the hash at lattice points and eases between them', () => {
    expect(valueNoise(4, 5, 9)).toBeCloseTo(coordinateHash(4, 5, 9), 12);
    const halfway = valueNoise(4.5, 5, 9);
    expect(halfway).toBeCloseTo((coordinateHash(4, 5, 9) + coordinateHash(5, 5, 9)) / 2, 12);
  });
});

describe('PeriodicNoise', () => {
  const noise = new PeriodicNoise(shoreRandom('lattice'));

  it('wraps with its period on both axes, so a tile drawn from it has no seam', () => {
    const period = { x: 6, y: 4 };
    for (const [x, y] of [
      [0.3, 0.7],
      [2.25, 3.9],
    ] as const) {
      expect(noise.noise(x + period.x, y, period, 11)).toBeCloseTo(noise.noise(x, y, period, 11), 12);
      expect(noise.noise(x, y + period.y, period, 11)).toBeCloseTo(noise.noise(x, y, period, 11), 12);
    }
  });

  it('sums octaves into [0, 1] that wrap with the tile', () => {
    const left = noise.fbm({ across: 0, down: 0.4 }, square(6), 5, 11);
    const right = noise.fbm({ across: 1, down: 0.4 }, square(6), 5, 11);
    expect(left).toBeCloseTo(right, 12);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left).toBeLessThanOrEqual(1);
  });

  it('is the same from the same seeded stream: a reload draws the same tiles', () => {
    const again = new PeriodicNoise(shoreRandom('lattice'));
    expect(again.fbm({ across: 0.37, down: 0.81 }, square(8), 4, 91)).toBe(
      noise.fbm({ across: 0.37, down: 0.81 }, square(8), 4, 91),
    );
  });
});

describe('wrappingVoronoi', () => {
  const jitter = (cellX: number, cellY: number, axis: number): number =>
    coordinateHash(cellX, cellY, 601 + axis) * 0.9 + 0.05;

  it('answers the nearest site no farther than the second', () => {
    const cells = wrappingVoronoi(0.42, 0.17, 14, jitter);
    expect(cells.nearest).toBeLessThanOrEqual(cells.second);
    expect(cells.nearest).toBeLessThan(1 / 14);
  });

  it('wraps: the left and right edges of the tile see the same sites', () => {
    expect(wrappingVoronoi(0, 0.5, 6, jitter).nearest).toBeCloseTo(
      wrappingVoronoi(1 - 1e-12, 0.5, 6, jitter).nearest,
      6,
    );
  });
});
