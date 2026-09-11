// The 256 × N RGBA jitter / lobes strip (docs/RENDERING.md §2.1): a cell reads its row at
// `θ / 2π + φ` for the ±0.8 % jitter (seeded value noise) and the sum of its 5–7 rest lobes. One
// row per cell variant, built once per round from the cosmetic fork. Each value is a 16-bit pair
// (R G = jitter hi lo, B A = lobes hi lo) read with `texelFetch` and lerped by hand on both sides,
// and the derivative in θ is the slope of that lerp, so the TypeScript profile and the GLSL agree
// exactly (a byte-quantised derivative channel could not meet the §9 pin).

import { RADIANS_PER_FULL_TURN, RANDOM_STREAM, type RandomSource } from '@evolution/shared';
import {
  NOISE_STRIP_JITTER_KNOTS,
  NOISE_STRIP_JITTER_SCALE,
  NOISE_STRIP_LOBE_SCALE,
  NOISE_STRIP_ROWS,
  NOISE_STRIP_VALUE_LEVELS,
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
const BYTE_LEVELS = 256;
const BYTE_MAX = BYTE_LEVELS - 1;
const HALF = 0.5;
/** A uniform draw in [0, 1) maps to a signed unit value by this span. */
const SIGNED_UNIT_SPAN = 2;
/** Lobe centres sit evenly around the ring and jitter by this share of the spacing so they never pile up. */
const LOBE_CENTRE_JITTER = 0.2;
const JITTER_HI = 0;
const JITTER_LO = 1;
const LOBES_HI = 2;
const LOBES_LO = 3;

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
  /** Derivatives in θ (per radian): the slope of the lerp between the two texels read. */
  readonly jitterDerivative: number;
  readonly lobesDerivative: number;
}

export interface NoiseStrip {
  readonly width: number;
  readonly rows: number;
  /** RGBA bytes, row-major, `width × rows × 4`: jitter hi, jitter lo, lobes hi, lobes lo. */
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

function lobesAt(lobes: readonly RestLobe[], theta: number): number {
  let value = 0;
  for (const lobe of lobes) value += gaussianBump(lobe.amplitude, wrapAngle(theta - lobe.centre), lobe.sigma).value;
  return value;
}

/** Periodic cosine-interpolated value noise on `knots`. */
function jitterAt(knots: readonly number[], theta: number): number {
  const unit = (((theta / RADIANS_PER_FULL_TURN) % 1) + 1) % 1;
  const position = unit * knots.length;
  const index = Math.floor(position);
  const fraction = position - index;
  const fromKnot = knots[index % knots.length] ?? 0;
  const toKnot = knots[(index + 1) % knots.length] ?? 0;
  return lerp(fromKnot, toKnot, (1 - Math.cos(Math.PI * fraction)) * HALF);
}

/** A signed value in [−scale, scale] as a 16-bit level, split into a hi and a lo byte. */
function encodeSigned(value: number, scale: number): [number, number] {
  const unit = Math.max(-1, Math.min(1, value / scale));
  const level = Math.round((unit + 1) * HALF * NOISE_STRIP_VALUE_LEVELS);
  return [Math.floor(level / BYTE_LEVELS), level % BYTE_LEVELS];
}

function decodeSigned(highByte: number, lowByte: number, scale: number): number {
  return ((highByte * BYTE_LEVELS + lowByte) / NOISE_STRIP_VALUE_LEVELS) * SIGNED_UNIT_SPAN * scale - scale;
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
      const jitter = encodeSigned(jitterAt(knots, theta), NOISE_STRIP_JITTER_SCALE);
      const lobe = encodeSigned(lobesAt(lobes, theta), NOISE_STRIP_LOBE_SCALE);
      const offset = (row * NOISE_STRIP_WIDTH + column) * RGBA_CHANNELS;
      bytes[offset + JITTER_HI] = jitter[0];
      bytes[offset + JITTER_LO] = jitter[1];
      bytes[offset + LOBES_HI] = lobe[0];
      bytes[offset + LOBES_LO] = lobe[1];
    }
  }
  return { width: NOISE_STRIP_WIDTH, rows: NOISE_STRIP_ROWS, bytes, lobeCounts };
}

/**
 * Samples one row at `unit` (turns) exactly as the shader does: two `texelFetch` reads (texel
 * centres at `(column + 0.5) / width`), a lerp between them and the slope of that lerp per radian.
 */
export function sampleNoiseStrip(strip: NoiseStrip, row: number, unit: number): NoiseStripSample {
  const wrappedRow = ((row % strip.rows) + strip.rows) % strip.rows;
  const texel = (((unit % 1) + 1) % 1) * strip.width - HALF;
  const left = Math.floor(texel);
  const fraction = texel - left;
  const leftColumn = ((left % strip.width) + strip.width) % strip.width;
  const rightColumn = (leftColumn + 1) % strip.width;
  const radiansPerTexel = RADIANS_PER_FULL_TURN / strip.width;
  const read = (column: number, highChannel: number, lowChannel: number, scale: number) => {
    const offset = (wrappedRow * strip.width + column) * RGBA_CHANNELS;
    return decodeSigned(strip.bytes[offset + highChannel] ?? 0, strip.bytes[offset + lowChannel] ?? BYTE_MAX, scale);
  };
  const channel = (highChannel: number, lowChannel: number, scale: number) => {
    const fromValue = read(leftColumn, highChannel, lowChannel, scale);
    const toValue = read(rightColumn, highChannel, lowChannel, scale);
    return { value: lerp(fromValue, toValue, fraction), derivative: (toValue - fromValue) / radiansPerTexel };
  };
  const jitter = channel(JITTER_HI, JITTER_LO, NOISE_STRIP_JITTER_SCALE);
  const lobes = channel(LOBES_HI, LOBES_LO, NOISE_STRIP_LOBE_SCALE);
  return {
    jitter: jitter.value,
    lobes: lobes.value,
    jitterDerivative: jitter.derivative,
    lobesDerivative: lobes.derivative,
  };
}
