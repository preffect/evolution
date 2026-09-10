// The 256 × N RGBA jitter / lobes strip (docs/RENDERING.md §2.1): R is seeded value noise (the
// ±0.8 % jitter), G the sum of 5–7 rest lobes, B and A their derivatives in θ. One row per cell
// variant; a cell reads its row at `θ / 2π + φ`. Built once per round from the cosmetic fork; the
// TypeScript profile samples the same bytes the GPU does (noise-strip sampling below).

import { RADIANS_PER_FULL_TURN, RANDOM_STREAM, type RandomSource } from '@evolution/shared';
import {
  NOISE_STRIP_DERIVATIVE_SCALE,
  NOISE_STRIP_JITTER_KNOTS,
  NOISE_STRIP_LOBE_SCALE,
  NOISE_STRIP_ROWS,
  NOISE_STRIP_WIDTH,
  REST_LOBE_AMPLITUDE_MAX,
  REST_LOBE_AMPLITUDE_MIN,
  REST_LOBE_COUNT_MAX,
  REST_LOBE_COUNT_MIN,
  REST_LOBE_SIGMA_RAD_MAX,
  REST_LOBE_SIGMA_RAD_MIN,
} from '../constants';
import { gaussianBump, lerp, wrapAngle } from '../geometry';

const RGBA_CHANNELS = 4;
const BYTE_MAX = 255;
const HALF_BYTE = 127.5;
const HALF = 0.5;
/** A uniform draw in [0, 1) maps to a signed unit value by this span. */
const SIGNED_UNIT_SPAN = 2;
/** Lobe centres sit evenly around the ring and jitter by this share of the spacing so they never pile up. */
const LOBE_CENTRE_JITTER = 0.2;
const JITTER_CHANNEL = 0;
const LOBES_CHANNEL = 1;
const JITTER_DERIVATIVE_CHANNEL = 2;
const LOBES_DERIVATIVE_CHANNEL = 3;

/** A uniform draw in [0, 1) as a signed value in [−1, 1). */
function signedDraw(random: RandomSource): number {
  return random.nextFloat() * SIGNED_UNIT_SPAN - 1;
}
export const NOISE_STRIP_LABEL = `${RANDOM_STREAM.cosmetic}:strip`;

export interface NoiseStripSample {
  /** The jitter channel in [−1, 1]. */
  readonly jitter: number;
  /** The lobes channel, a radius fraction. */
  readonly lobes: number;
  /** Derivatives in θ (per radian). */
  readonly jitterDerivative: number;
  readonly lobesDerivative: number;
}

export interface NoiseStrip {
  readonly width: number;
  readonly rows: number;
  /** RGBA bytes, row-major, `width × rows × 4`. */
  readonly bytes: Uint8Array;
  /** Rest lobes per row (the test's 5–7 pin). */
  readonly lobeCounts: readonly number[];
}

interface RestLobe {
  readonly amplitude: number;
  readonly centre: number;
  readonly sigma: number;
}

function drawLobes(random: RandomSource): RestLobe[] {
  const count = random.nextInt(REST_LOBE_COUNT_MIN, REST_LOBE_COUNT_MAX);
  const spacing = RADIANS_PER_FULL_TURN / count;
  const phase = random.nextFloat() * spacing;
  return Array.from({ length: count }, (_unused, index) => ({
    amplitude:
      lerp(REST_LOBE_AMPLITUDE_MIN, REST_LOBE_AMPLITUDE_MAX, random.nextFloat()) * (random.nextFloat() < HALF ? -1 : 1),
    centre: phase + index * spacing + signedDraw(random) * LOBE_CENTRE_JITTER * spacing,
    sigma: lerp(REST_LOBE_SIGMA_RAD_MIN, REST_LOBE_SIGMA_RAD_MAX, random.nextFloat()),
  }));
}

function lobesAt(lobes: readonly RestLobe[], theta: number): { value: number; derivative: number } {
  let value = 0;
  let derivative = 0;
  for (const lobe of lobes) {
    const bump = gaussianBump(lobe.amplitude, wrapAngle(theta - lobe.centre), lobe.sigma);
    value += bump.value;
    derivative += bump.derivative;
  }
  return { value, derivative };
}

/** Periodic cosine-interpolated value noise on `knots`, with its derivative per radian. */
function jitterAt(knots: readonly number[], theta: number): { value: number; derivative: number } {
  const unit = (((theta / RADIANS_PER_FULL_TURN) % 1) + 1) % 1;
  const position = unit * knots.length;
  const index = Math.floor(position);
  const fraction = position - index;
  const fromKnot = knots[index % knots.length] ?? 0;
  const toKnot = knots[(index + 1) % knots.length] ?? 0;
  const blend = (1 - Math.cos(Math.PI * fraction)) * HALF;
  const blendDerivative = Math.PI * Math.sin(Math.PI * fraction) * HALF;
  const value = lerp(fromKnot, toKnot, blend);
  const derivative = ((toKnot - fromKnot) * blendDerivative * knots.length) / RADIANS_PER_FULL_TURN;
  return { value, derivative };
}

function encodeSigned(value: number, scale: number): number {
  const unit = Math.max(-1, Math.min(1, value / scale));
  return Math.round((unit + 1) * HALF_BYTE);
}

function decodeSigned(byte: number, scale: number): number {
  return (byte / HALF_BYTE - 1) * scale;
}

/** Bakes every row of the strip from the cosmetic fork; same seed ⇒ same bytes. */
export function buildNoiseStrip(cosmetic: RandomSource): NoiseStrip {
  const bytes = new Uint8Array(NOISE_STRIP_WIDTH * NOISE_STRIP_ROWS * RGBA_CHANNELS);
  const lobeCounts: number[] = [];
  const stripRandom = cosmetic.fork(NOISE_STRIP_LABEL);
  for (let row = 0; row < NOISE_STRIP_ROWS; row += 1) {
    const rowRandom = stripRandom.fork(String(row));
    const knots = Array.from({ length: NOISE_STRIP_JITTER_KNOTS }, () => signedDraw(rowRandom));
    const lobes = drawLobes(rowRandom);
    lobeCounts.push(lobes.length);
    for (let column = 0; column < NOISE_STRIP_WIDTH; column += 1) {
      const theta = ((column + HALF) / NOISE_STRIP_WIDTH) * RADIANS_PER_FULL_TURN;
      const jitter = jitterAt(knots, theta);
      const lobe = lobesAt(lobes, theta);
      const offset = (row * NOISE_STRIP_WIDTH + column) * RGBA_CHANNELS;
      bytes[offset + JITTER_CHANNEL] = encodeSigned(jitter.value, 1);
      bytes[offset + LOBES_CHANNEL] = encodeSigned(lobe.value, NOISE_STRIP_LOBE_SCALE);
      bytes[offset + JITTER_DERIVATIVE_CHANNEL] = encodeSigned(jitter.derivative, NOISE_STRIP_DERIVATIVE_SCALE);
      bytes[offset + LOBES_DERIVATIVE_CHANNEL] = encodeSigned(lobe.derivative, NOISE_STRIP_DERIVATIVE_SCALE);
    }
  }
  return { width: NOISE_STRIP_WIDTH, rows: NOISE_STRIP_ROWS, bytes, lobeCounts };
}

/**
 * Samples one row at `unit` (turns) exactly as the GPU's LINEAR / REPEAT read does, so the
 * TypeScript profile and the shader agree to byte precision.
 */
export function sampleNoiseStrip(strip: NoiseStrip, row: number, unit: number): NoiseStripSample {
  const wrappedRow = ((row % strip.rows) + strip.rows) % strip.rows;
  const texel = (((unit % 1) + 1) % 1) * strip.width - HALF;
  const left = Math.floor(texel);
  const fraction = texel - left;
  const leftColumn = ((left % strip.width) + strip.width) % strip.width;
  const rightColumn = (leftColumn + 1) % strip.width;
  const read = (column: number, channel: number) =>
    strip.bytes[(wrappedRow * strip.width + column) * RGBA_CHANNELS + channel] ?? BYTE_MAX * HALF;
  const channel = (index: number, scale: number) =>
    lerp(decodeSigned(read(leftColumn, index), scale), decodeSigned(read(rightColumn, index), scale), fraction);
  return {
    jitter: channel(JITTER_CHANNEL, 1),
    lobes: channel(LOBES_CHANNEL, NOISE_STRIP_LOBE_SCALE),
    jitterDerivative: channel(JITTER_DERIVATIVE_CHANNEL, NOISE_STRIP_DERIVATIVE_SCALE),
    lobesDerivative: channel(LOBES_DERIVATIVE_CHANNEL, NOISE_STRIP_DERIVATIVE_SCALE),
  };
}
