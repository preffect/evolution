import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '@evolution/shared';
import { buildNoiseTile, fractalNoiseAt } from './noise-tile';

const TEST_SEED = 11;
const SMALL = 32;

describe('noise tile', () => {
  it('bakes an opaque two-channel tile of the requested size, seeded', () => {
    const tile = buildNoiseTile(createSeededRandom(TEST_SEED), SMALL);
    expect(tile.bytes).toHaveLength(SMALL * SMALL * 4);
    expect(tile.bytes[3]).toBe(255);
    expect(buildNoiseTile(createSeededRandom(TEST_SEED), SMALL).bytes).toEqual(tile.bytes);
    expect(buildNoiseTile(createSeededRandom(TEST_SEED + 1), SMALL).bytes).not.toEqual(tile.bytes);
  });

  it('varies across the tile in both channels and stays inside a byte', () => {
    const tile = buildNoiseTile(createSeededRandom(TEST_SEED), SMALL);
    const coarse = new Set<number>();
    const fine = new Set<number>();
    for (let index = 0; index < SMALL * SMALL; index += 1) {
      coarse.add(tile.bytes[index * 4]!);
      fine.add(tile.bytes[index * 4 + 1]!);
    }
    expect(coarse.size).toBeGreaterThan(20);
    expect(fine.size).toBeGreaterThan(20);
  });

  it('is periodic: the noise wraps at the tile edge', () => {
    const lattices = [Float32Array.from({ length: 16 }, (_unused, index) => ((index * 7) % 5) / 5)];
    const spec = { octaves: 1, cycles: 4 };
    expect(fractalNoiseAt(lattices, spec, 0.13, 0.37)).toBeCloseTo(fractalNoiseAt(lattices, spec, 1.13, -0.63), 9);
    expect(fractalNoiseAt(lattices, spec, 0.13, 0.37)).toBeGreaterThanOrEqual(0);
    expect(fractalNoiseAt(lattices, spec, 0.13, 0.37)).toBeLessThanOrEqual(1);
  });
});
