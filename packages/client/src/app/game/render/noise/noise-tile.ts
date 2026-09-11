// The 256² two-channel cytoplasm tile (docs/RENDERING.md §2.2): R is the coarse mottle (3 octaves,
// 12 cycles per tile), G the fine one (2 octaves, 29 cycles), both periodic value noise from the
// field fork of the cosmetic stream, sampled in world units so the mottle translates with a cell
// and never scales with it. Bytes for the GPU; the same bytes for a test.

import { COSMETIC_SUB_STREAM, lerp, type RandomSource } from '@evolution/shared';
import { ALPHA, CHANNEL_MAX, GREEN, RED } from '../colour';
import { CYTO_NOISE_COARSE, CYTO_NOISE_FINE, NOISE_TILE_SIZE_PX } from '../constants';
import { HALF } from '../geometry';

const RGBA_CHANNELS = 4;
/** Each octave doubles the lattice frequency and halves its amplitude. */
const OCTAVE_LACUNARITY = 2;
const OCTAVE_GAIN = 0.5;
const COARSE_CHANNEL = RED;
const FINE_CHANNEL = GREEN;
const OCTAVE_LABEL = 'octave';

export interface NoiseSpec {
  readonly octaves: number;
  readonly cycles: number;
}

export interface NoiseTile {
  readonly size: number;
  /** RGBA bytes, row-major; R coarse, G fine, B unused, A opaque. */
  readonly bytes: Uint8Array;
}

/** A periodic lattice of `cycles × cycles` knots in [0, 1). */
function lattice(cycles: number, random: RandomSource): Float32Array {
  return Float32Array.from({ length: cycles * cycles }, () => random.nextFloat());
}

function smooth(fraction: number): number {
  return (1 - Math.cos(Math.PI * fraction)) * HALF;
}

/** Wraps a position in turns into [0, 1). */
function wrapUnit(unit: number): number {
  return ((unit % 1) + 1) % 1;
}

/** Cosine-interpolated value noise on a periodic lattice at `(unitX, unitY)` in turns of the tile. */
function latticeAt(knots: Float32Array, cycles: number, unitX: number, unitY: number): number {
  const scaledX = wrapUnit(unitX) * cycles;
  const scaledY = wrapUnit(unitY) * cycles;
  const column = Math.floor(scaledX);
  const row = Math.floor(scaledY);
  const knot = (knotColumn: number, knotRow: number): number =>
    knots[(knotRow % cycles) * cycles + (knotColumn % cycles)] ?? 0;
  const top = lerp(knot(column, row), knot(column + 1, row), smooth(scaledX - column));
  const bottom = lerp(knot(column, row + 1), knot(column + 1, row + 1), smooth(scaledX - column));
  return lerp(top, bottom, smooth(scaledY - row));
}

/** Fractal value noise in [0, 1]: octaves of doubling frequency and halving amplitude, renormalised. */
export function fractalNoiseAt(
  lattices: readonly Float32Array[],
  spec: NoiseSpec,
  unitX: number,
  unitY: number,
): number {
  let value = 0;
  let amplitude = 1;
  let total = 0;
  lattices.forEach((knots, octave) => {
    const cycles = spec.cycles * OCTAVE_LACUNARITY ** octave;
    value += latticeAt(knots, cycles, unitX, unitY) * amplitude;
    total += amplitude;
    amplitude *= OCTAVE_GAIN;
  });
  return value / total;
}

/** One lattice per octave, each from its own fork so an octave count change leaves the others alone. */
export function buildLattices(spec: NoiseSpec, random: RandomSource): Float32Array[] {
  return Array.from({ length: spec.octaves }, (_unused, octave) =>
    lattice(spec.cycles * OCTAVE_LACUNARITY ** octave, random.fork(`${OCTAVE_LABEL}:${octave}`)),
  );
}

/** Bakes the tile from the cosmetic fork; same seed ⇒ same bytes. */
export function buildNoiseTile(cosmetic: RandomSource, size: number = NOISE_TILE_SIZE_PX): NoiseTile {
  const random = cosmetic.fork(COSMETIC_SUB_STREAM.field);
  const coarse = buildLattices(CYTO_NOISE_COARSE, random.fork(`${COSMETIC_SUB_STREAM.field}:coarse`));
  const fine = buildLattices(CYTO_NOISE_FINE, random.fork(`${COSMETIC_SUB_STREAM.field}:fine`));
  const bytes = new Uint8Array(size * size * RGBA_CHANNELS);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const unitX = (column + HALF) / size;
      const unitY = (row + HALF) / size;
      const offset = (row * size + column) * RGBA_CHANNELS;
      bytes[offset + COARSE_CHANNEL] = Math.round(
        fractalNoiseAt(coarse, CYTO_NOISE_COARSE, unitX, unitY) * CHANNEL_MAX,
      );
      bytes[offset + FINE_CHANNEL] = Math.round(fractalNoiseAt(fine, CYTO_NOISE_FINE, unitX, unitY) * CHANNEL_MAX);
      bytes[offset + ALPHA] = CHANNEL_MAX;
    }
  }
  return { size, bytes };
}
