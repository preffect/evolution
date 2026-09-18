// The 256² two-channel cytoplasm tile (docs/rendering/cells.md §2.2): R is the coarse mottle (3 octaves,
// 12 cycles per tile), G the fine one (2 octaves, 29 cycles), both periodic value noise from the
// field fork of the cosmetic stream, sampled in world units so the mottle translates with a cell
// and never scales with it. Bytes for the GPU; the same bytes for a test.

import { COSMETIC_SUB_STREAM, lerp, type RandomSource } from '@evolution/shared';
import { ALPHA, CHANNEL_MAX, GREEN, RED, RGBA_CHANNELS } from '../colour';
import { CYTO_NOISE_COARSE, CYTO_NOISE_FINE, NOISE_TILE_SIZE_PX } from '../constants';
import { HALF, cosineSmoothstep, wrapUnit } from '../geometry';

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

/** One octave of a fractal: its lattice, the lattice's period and the octave's weight in the sum. */
interface NoiseOctave {
  readonly knots: Float32Array;
  readonly cycles: number;
  readonly amplitude: number;
}

/**
 * The octave table a fractal is summed over, and the amplitude total the sum is renormalised by:
 * frequency doubles and amplitude halves down the list. Built once per fractal rather than per
 * sample, since `spec.cycles * 2 ** octave` is the same number at every pixel of a tile (ticket #442).
 */
interface NoiseFractal {
  readonly octaves: readonly NoiseOctave[];
  readonly total: number;
}

/**
 * One octave's terms at a fixed `unitY`: the two knot rows the sample lerps between, and the weight
 * between them. A tile row shares these across all its columns, so they are taken once per row
 * rather than once per pixel — the tile samples 5 octaves at 65 536 pixels per bake (ticket #442).
 */
interface NoiseOctaveRow {
  readonly knots: Float32Array;
  readonly cycles: number;
  readonly amplitude: number;
  readonly rowBase: number;
  readonly rowNextBase: number;
  readonly rowWeight: number;
}

function noiseFractal(lattices: readonly Float32Array[], spec: NoiseSpec): NoiseFractal {
  const octaves: NoiseOctave[] = [];
  let amplitude = 1;
  let total = 0;
  lattices.forEach((knots, octave) => {
    octaves.push({ knots, cycles: spec.cycles * OCTAVE_LACUNARITY ** octave, amplitude });
    total += amplitude;
    amplitude *= OCTAVE_GAIN;
  });
  return { octaves, total };
}

function octaveRowAt(octave: NoiseOctave, unitY: number): NoiseOctaveRow {
  const { cycles } = octave;
  const scaledY = wrapUnit(unitY) * cycles;
  const row = Math.floor(scaledY);
  return {
    knots: octave.knots,
    cycles,
    amplitude: octave.amplitude,
    rowBase: (row % cycles) * cycles,
    rowNextBase: ((row + 1) % cycles) * cycles,
    rowWeight: cosineSmoothstep(scaledY - row),
  };
}

/** Cosine-interpolated value noise on one octave's row at `unitX` turns across the tile. */
function octaveRowSample(row: NoiseOctaveRow, unitX: number): number {
  const { knots, cycles, rowBase, rowNextBase } = row;
  const scaledX = wrapUnit(unitX) * cycles;
  const column = Math.floor(scaledX);
  const columnHere = column % cycles;
  const columnNext = (column + 1) % cycles;
  const columnWeight = cosineSmoothstep(scaledX - column);
  const top = lerp(knots[rowBase + columnHere] ?? 0, knots[rowBase + columnNext] ?? 0, columnWeight);
  const bottom = lerp(knots[rowNextBase + columnHere] ?? 0, knots[rowNextBase + columnNext] ?? 0, columnWeight);
  return lerp(top, bottom, row.rowWeight);
}

/** Every octave of a fractal at one `unitY`: what a tile row is sampled through. */
function fractalRowAt(fractal: NoiseFractal, unitY: number): readonly NoiseOctaveRow[] {
  return fractal.octaves.map((octave) => octaveRowAt(octave, unitY));
}

function fractalRowSample(rows: readonly NoiseOctaveRow[], total: number, unitX: number): number {
  let value = 0;
  for (const row of rows) value += octaveRowSample(row, unitX) * row.amplitude;
  return value / total;
}

/**
 * Fractal value noise in [0, 1]: octaves of doubling frequency and halving amplitude, renormalised.
 * The **single-sample reference**, and since #442 not the path the bake takes: `buildNoiseTile` goes through
 * `fractalRowAt` once per tile row and `fractalRowSample` per pixel, so optimising this function buys a bake
 * nothing. It is kept because it is a thin wrapper over that same path, which is what lets the periodicity
 * test drive production code with one call.
 */
export function fractalNoiseAt(
  lattices: readonly Float32Array[],
  spec: NoiseSpec,
  unitX: number,
  unitY: number,
): number {
  const fractal = noiseFractal(lattices, spec);
  return fractalRowSample(fractalRowAt(fractal, unitY), fractal.total, unitX);
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
  const coarseLattices = buildLattices(CYTO_NOISE_COARSE, random.fork(`${COSMETIC_SUB_STREAM.field}:coarse`));
  const fineLattices = buildLattices(CYTO_NOISE_FINE, random.fork(`${COSMETIC_SUB_STREAM.field}:fine`));
  const coarse = noiseFractal(coarseLattices, CYTO_NOISE_COARSE);
  const fine = noiseFractal(fineLattices, CYTO_NOISE_FINE);
  const bytes = new Uint8Array(size * size * RGBA_CHANNELS);
  for (let row = 0; row < size; row += 1) {
    const unitY = (row + HALF) / size;
    const coarseRow = fractalRowAt(coarse, unitY);
    const fineRow = fractalRowAt(fine, unitY);
    for (let column = 0; column < size; column += 1) {
      const unitX = (column + HALF) / size;
      const offset = (row * size + column) * RGBA_CHANNELS;
      bytes[offset + COARSE_CHANNEL] = Math.round(fractalRowSample(coarseRow, coarse.total, unitX) * CHANNEL_MAX);
      bytes[offset + FINE_CHANNEL] = Math.round(fractalRowSample(fineRow, fine.total, unitX) * CHANNEL_MAX);
      bytes[offset + ALPHA] = CHANNEL_MAX;
    }
  }
  return { size, bytes };
}
