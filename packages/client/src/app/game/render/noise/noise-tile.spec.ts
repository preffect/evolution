import { describe, expect, it } from 'vitest';
import { RANDOM_STREAM, createSeededRandom } from '@evolution/shared';
import { CYTO_NOISE_COARSE, NOISE_TILE_SIZE_PX } from '../constants';
import { buildLattices, buildNoiseTile, fractalNoiseAt } from './noise-tile';

const TEST_SEED = 11;
const SMALL = 32;
const RGBA = 4;

function cosmetic(seed = TEST_SEED) {
  return createSeededRandom(seed).fork(RANDOM_STREAM.cosmetic);
}

describe('noise tile', () => {
  it('bakes an opaque two-channel tile of the requested size, seeded, at the atlas size by default', () => {
    const tile = buildNoiseTile(cosmetic(), SMALL);
    expect(tile.size).toBe(SMALL);
    expect(tile.bytes).toHaveLength(SMALL * SMALL * RGBA);
    expect(tile.bytes[3]).toBe(255);
    expect(buildNoiseTile(cosmetic(), SMALL).bytes).toEqual(tile.bytes);
    expect(buildNoiseTile(cosmetic(TEST_SEED + 1), SMALL).bytes).not.toEqual(tile.bytes);
    expect(buildNoiseTile(cosmetic()).size).toBe(NOISE_TILE_SIZE_PX);
  });

  it('varies across the tile in both channels and stays inside a byte', () => {
    const tile = buildNoiseTile(cosmetic(), SMALL);
    const coarse = new Set<number>();
    const fine = new Set<number>();
    for (let index = 0; index < SMALL * SMALL; index += 1) {
      coarse.add(tile.bytes[index * RGBA]!);
      fine.add(tile.bytes[index * RGBA + 1]!);
    }
    expect(coarse.size).toBeGreaterThan(20);
    expect(fine.size).toBeGreaterThan(20);
  });

  it('is periodic: the noise wraps at the tile edge and stays in [0, 1]', () => {
    const lattices = [Float32Array.from({ length: 16 }, (_unused, index) => ((index * 7) % 5) / 5)];
    const spec = { octaves: 1, cycles: 4 };
    const here = fractalNoiseAt(lattices, spec, 0.13, 0.37);
    expect(here).toBeCloseTo(fractalNoiseAt(lattices, spec, 1.13, -0.63), 9);
    expect(here).toBeGreaterThanOrEqual(0);
    expect(here).toBeLessThanOrEqual(1);
  });

  it('builds one lattice per octave, each doubling the cycle count', () => {
    const lattices = buildLattices(CYTO_NOISE_COARSE, cosmetic());
    expect(lattices).toHaveLength(CYTO_NOISE_COARSE.octaves);
    expect(lattices.map((lattice) => lattice.length)).toEqual(
      Array.from(
        { length: CYTO_NOISE_COARSE.octaves },
        (_unused, octave) => (CYTO_NOISE_COARSE.cycles * 2 ** octave) ** 2,
      ),
    );
  });
});
