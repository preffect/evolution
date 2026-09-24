// The amoeba's silhouette and motion (docs/rendering/cells.md §2.1 pseudopods row, §2.4; docs/visual-style/
// motion-and-legibility.md §5; sheet 04): a core shrunk to `AMOEBA_CORE_SCALE` and 2 / 3 / 4 blunt pseudopod bumps in
// the reserved slots. The lobes fan out about the held heading at rest and gather toward the velocity as the cell
// speeds up (toward the engulfed prey while it engulfs); each extends and retracts on its own staggered sine, so one
// arm reaches while its neighbour pulls back. Pure over time and the cosmetic phase, like every rest term.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import {
  AMOEBA_CORE_SCALE,
  PSEUDOPOD_CYCLE_HZ,
  PSEUDOPOD_LEAN_STEP_DEG,
  PSEUDOPOD_PEAK_ANGLE_SAMPLES_PER_SIGMA,
  PSEUDOPOD_PEAK_TIME_SAMPLES,
  PSEUDOPOD_REST_STEP_DEG,
  PSEUDOPOD_RETRACTED_SHARE,
  PSEUDOPOD_SIGMA_DEG,
  PSEUDOPOD_SWAY_DEG,
  PSEUDOPOD_SWAY_HZ,
} from '../../constants';
import { HALF, degreesToRadians, gaussianBump, wrapAngle } from '../../geometry';
import type { FormProfile, ShapeBump } from '../radial-profile';

export interface PseudopodInput {
  /** `pseudopodCount` at the form's tier; 0 draws none. */
  readonly count: number;
  readonly timeSeconds: number;
  /** The cell's cosmetic phase, turns. */
  readonly phase: number;
  /** Where the fan points: the engulfed prey's angle, else the resolved heading (radians, cell frame). */
  readonly aim: number;
  /** 0 → the wide rest fan, 1 → the gathered fan: the speed ratio. */
  readonly lean: number;
}

const SIGMA = degreesToRadians(PSEUDOPOD_SIGMA_DEG);
const REST_STEP = degreesToRadians(PSEUDOPOD_REST_STEP_DEG);
const LEAN_STEP = degreesToRadians(PSEUDOPOD_LEAN_STEP_DEG);
const SWAY = degreesToRadians(PSEUDOPOD_SWAY_DEG);
const REACHING_SHARE = 1 - PSEUDOPOD_RETRACTED_SHARE;

/** `∫ exp(−x² / 2σ²) dx = σ √(2π)` and `∫ exp(−x² / σ²) dx = σ √π`: one lobe's area terms per unit reach. */
const LOBE_LINEAR_AREA = SIGMA * Math.sqrt(RADIANS_PER_FULL_TURN);
const LOBE_SQUARE_AREA = SIGMA * Math.sqrt(Math.PI);
/** `(1 + r)² = 1 + 2r + r²`, and the quadratic formula's `2a` and `4ac`. */
const CROSS_TERM_FACTOR = 2;
const QUADRATIC_DENOMINATOR_FACTOR = 2;
const QUADRATIC_DISCRIMINANT_FACTOR = 4;
/** `⟨s²⟩` of the raised sine `s = ½ + ½ sin`, whose mean is ½. */
const RAISED_SINE_MEAN_SQUARE = 0.375;
/** The extension share's mean and mean square over a cycle: `R + (1 − R) s`. */
const MEAN_SHARE = PSEUDOPOD_RETRACTED_SHARE + REACHING_SHARE * HALF;
const MEAN_SQUARE_SHARE =
  PSEUDOPOD_RETRACTED_SHARE * PSEUDOPOD_RETRACTED_SHARE +
  CROSS_TERM_FACTOR * PSEUDOPOD_RETRACTED_SHARE * REACHING_SHARE * HALF +
  REACHING_SHARE * REACHING_SHARE * RAISED_SINE_MEAN_SQUARE;

/**
 * The full reach of one lobe, in core radii, that keeps the body at unit area (§2.4's size rule): the core's lost
 * `2π (1 / c² − 1)` is made up by `count` lobes over a cycle, `Σ ⟨2 a σ√(2π) + a² σ√π⟩`, solved for the reach.
 * Neighbours at rest sit ≥ 4σ apart, so their overlap is left out (the area spec pins the whole thing to 0.5 %).
 */
export function pseudopodReach(count: number): number {
  if (count === 0) return 0;
  const lostArea = RADIANS_PER_FULL_TURN * (1 / (AMOEBA_CORE_SCALE * AMOEBA_CORE_SCALE) - 1);
  const linear = count * CROSS_TERM_FACTOR * MEAN_SHARE * LOBE_LINEAR_AREA;
  const quadratic = count * MEAN_SQUARE_SHARE * LOBE_SQUARE_AREA;
  const discriminant = linear * linear + QUADRATIC_DISCRIMINANT_FACTOR * quadratic * lostArea;
  return (Math.sqrt(discriminant) - linear) / (QUADRATIC_DENOMINATOR_FACTOR * quadratic);
}

/** `B ≡ AMOEBA_CORE_SCALE`: the core the lobes grow from, the same at every angle. */
const CORE_SAMPLE = { value: AMOEBA_CORE_SCALE, derivative: 0 } as const;
export const AMOEBA_CORE_PROFILE: FormProfile = { evaluate: () => CORE_SAMPLE, peak: AMOEBA_CORE_SCALE };

/** How far out lobe `index` of `count` is this frame, as a share of its reach. */
function extensionShare(input: PseudopodInput, index: number): number {
  const turns = PSEUDOPOD_CYCLE_HZ * input.timeSeconds + input.phase + index / input.count;
  return PSEUDOPOD_RETRACTED_SHARE + REACHING_SHARE * (HALF + HALF * Math.sin(RADIANS_PER_FULL_TURN * turns));
}

/** The frame's lobes: `count` bumps fanned about `aim`, the fan narrowing and its sway fading with `lean`. */
export function pseudopodBumps(input: PseudopodInput): ShapeBump[] {
  const reach = pseudopodReach(input.count);
  const step = REST_STEP + (LEAN_STEP - REST_STEP) * input.lean;
  const swayTurns = PSEUDOPOD_SWAY_HZ * input.timeSeconds + input.phase;
  const sway = SWAY * (1 - input.lean) * Math.sin(RADIANS_PER_FULL_TURN * swayTurns);
  const middle = (input.count - 1) * HALF;
  return Array.from({ length: input.count }, (_unused, index) => ({
    amplitude: reach * extensionShare(input, index),
    centre: wrapAngle(input.aim + sway + step * (index - middle)),
    sigma: SIGMA,
  }));
}

/** The ring's sample spacing and the half of it a peak can hide in between two samples. */
const PEAK_ANGLE_STEP = SIGMA / PSEUDOPOD_PEAK_ANGLE_SAMPLES_PER_SIGMA;
const PEAK_ANGLE_SAMPLES = Math.ceil(RADIANS_PER_FULL_TURN / PEAK_ANGLE_STEP);
const HALF_STEP = HALF * PEAK_ANGLE_STEP;

/**
 * The largest `Σ bumps(θ)` on the ring, as a bound: the sampled maximum plus what a peak between two samples can add.
 * A Gaussian's curvature is at most `a / σ²`, so a sum's value half a step off its sampled neighbour differs by at
 * most `(h/2)² / 2 · Σ a / σ²` — about 0.1 % of a lobe at this spacing, and never an undercount.
 */
function ringPeak(bumps: readonly ShapeBump[]): number {
  let peak = 0;
  let curvature = 0;
  for (const bump of bumps) curvature += bump.amplitude / (bump.sigma * bump.sigma);
  for (let sample = 0; sample < PEAK_ANGLE_SAMPLES; sample += 1) {
    const theta = sample * PEAK_ANGLE_STEP;
    let sum = 0;
    for (const bump of bumps) sum += gaussianBump(bump.amplitude, wrapAngle(theta - bump.centre), bump.sigma).value;
    peak = Math.max(peak, sum);
  }
  return peak + HALF_STEP * HALF_STEP * HALF * curvature;
}

/**
 * What a peak between two time samples can add, per unit of summed reach: a lobe's share `R + (1 − R)(½ + ½ sin 2πu)`
 * curves by at most `(1 − R) / 2 · (2π)²` per cycle², so half a sample off it moves by at most `(h/2)² / 2` of that.
 */
const HALF_TIME_STEP = HALF / PSEUDOPOD_PEAK_TIME_SAMPLES;
const TIME_MISS_PER_REACH =
  HALF_TIME_STEP * HALF_TIME_STEP * HALF * REACHING_SHARE * HALF * RADIANS_PER_FULL_TURN * RADIANS_PER_FULL_TURN;

const peakCache = new Map<string, number>();

/**
 * The widest the lobes push the surface out at this `lean`, over any frame, in radii of the core: one extension
 * cycle walked (the sway, the aim and the phase only turn the fan or shift the cycle, so they cannot change its
 * peak), with what the samples could miss added so it stays a bound. Memoised, since the preview and the cull ask
 * for the same few leans every frame.
 */
export function pseudopodPeakRadii(count: number, lean: number): number {
  if (count === 0) return 0;
  const key = `${count}:${lean}`;
  const cached = peakCache.get(key);
  if (cached !== undefined) return cached;
  let peak = 0;
  for (let sample = 0; sample < PSEUDOPOD_PEAK_TIME_SAMPLES; sample += 1) {
    const timeSeconds = sample / PSEUDOPOD_PEAK_TIME_SAMPLES / PSEUDOPOD_CYCLE_HZ;
    peak = Math.max(peak, ringPeak(pseudopodBumps({ count, timeSeconds, phase: 0, aim: 0, lean })));
  }
  const bound = peak + TIME_MISS_PER_REACH * count * pseudopodReach(count);
  peakCache.set(key, bound);
  return bound;
}
