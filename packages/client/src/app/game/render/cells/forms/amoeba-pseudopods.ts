// The amoeba's silhouette and motion (docs/rendering/cells.md §2.1 pseudopods row, §2.4; docs/visual-style/
// motion-and-legibility.md §5; sheet 04): a core shrunk to `AMOEBA_CORE_SCALE` and 2 / 3 / 4 short, fat pseudopod bumps.
// At rest the lobes fan out irregularly about the held heading and sway; with speed they move out of the stretched
// front to the flanks (round the engulfed prey while it engulfs), so the body never reaches past the 1.3 r rings short
// of a sprint. Each lobe extends and retracts on its own staggered sine, so one arm reaches while its neighbour pulls
// back. Pure over time and the cosmetic phase, like every rest term.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import {
  AMOEBA_CORE_SCALE,
  PSEUDOPOD_CYCLE_HZ,
  PSEUDOPOD_FLANK_DEG,
  PSEUDOPOD_FLANK_SPREAD,
  PSEUDOPOD_LEAN_GAIN,
  PSEUDOPOD_PEAK_ANGLE_SAMPLES,
  PSEUDOPOD_PEAK_TIME_SAMPLES,
  PSEUDOPOD_REACH,
  PSEUDOPOD_REST_SKEW_DEG,
  PSEUDOPOD_REST_STEP_DEG,
  PSEUDOPOD_RETRACTED_SHARE,
  PSEUDOPOD_SWAY_DEG,
  PSEUDOPOD_SWAY_HZ,
} from '../../constants';
import { HALF, degreesToRadians, gaussianBump, wrapAngle } from '../../geometry';
import { stretchAt, type FormProfile, type ShapeBump, type StretchTerm } from '../radial-profile';

export interface PseudopodInput {
  /** `pseudopodCount` at the form's tier; 0 draws none. */
  readonly count: number;
  readonly timeSeconds: number;
  /** The cell's cosmetic phase, turns. */
  readonly phase: number;
  /** Where the fan points: the engulfed prey's angle, else the resolved heading (radians, cell frame). */
  readonly aim: number;
  /** 0 → the rest fan, 1 → full speed: the speed ratio, or at least `PSEUDOPOD_ENGULF_LEAN` while engulfing. */
  readonly lean: number;
}

const REST_STEP = degreesToRadians(PSEUDOPOD_REST_STEP_DEG);
const REST_SKEW = degreesToRadians(PSEUDOPOD_REST_SKEW_DEG);
const FLANK = degreesToRadians(PSEUDOPOD_FLANK_DEG);
const SWAY = degreesToRadians(PSEUDOPOD_SWAY_DEG);
const REACHING_SHARE = 1 - PSEUDOPOD_RETRACTED_SHARE;

/** `(1 + r)² = 1 + 2r + r²`: the cross term. */
const CROSS_TERM_FACTOR = 2;
/** `⟨s²⟩` of the raised sine `s = ½ + ½ sin`, whose mean is ½. */
const RAISED_SINE_MEAN_SQUARE = 0.375;
/** The extension share's mean and mean square over a cycle: `R + (1 − R) s`. */
const MEAN_SHARE = PSEUDOPOD_RETRACTED_SHARE + REACHING_SHARE * HALF;
const MEAN_SQUARE_SHARE =
  PSEUDOPOD_RETRACTED_SHARE * PSEUDOPOD_RETRACTED_SHARE +
  CROSS_TERM_FACTOR * PSEUDOPOD_RETRACTED_SHARE * REACHING_SHARE * HALF +
  REACHING_SHARE * REACHING_SHARE * RAISED_SINE_MEAN_SQUARE;

/**
 * The width of each of `count` lobes, radians, that keeps the body at unit area (§2.4's size rule): the core's lost
 * `2π (1 / c² − 1)` is made up over a cycle by `Σ ⟨2 a σ√(2π) + a² σ√π⟩`, which is linear in σ at a fixed reach. So
 * two lobes are fat and four are slim. Neighbours at rest sit ≥ 3σ apart, so their overlap is left out (the area
 * spec pins the whole thing to 0.5 % at rest).
 */
export function pseudopodSigma(count: number): number {
  const lostArea = RADIANS_PER_FULL_TURN * (1 / (AMOEBA_CORE_SCALE * AMOEBA_CORE_SCALE) - 1);
  const perRadianOfSigma =
    CROSS_TERM_FACTOR * MEAN_SHARE * PSEUDOPOD_REACH * Math.sqrt(RADIANS_PER_FULL_TURN) +
    MEAN_SQUARE_SHARE * PSEUDOPOD_REACH * PSEUDOPOD_REACH * Math.sqrt(Math.PI);
  return lostArea / (count * perRadianOfSigma);
}

/** `B ≡ AMOEBA_CORE_SCALE`: the core the lobes grow from, the same at every angle. */
const CORE_SAMPLE = { value: AMOEBA_CORE_SCALE, derivative: 0 } as const;
export const AMOEBA_CORE_PROFILE: FormProfile = { evaluate: () => CORE_SAMPLE, peak: AMOEBA_CORE_SCALE };

/** How far out lobe `index` of `count` is at `cycleTurns` into its cycle, as a share of its reach. */
function extensionShare(cycleTurns: number, index: number, count: number): number {
  const turns = cycleTurns + index / count;
  return PSEUDOPOD_RETRACTED_SHARE + REACHING_SHARE * (HALF + HALF * Math.sin(RADIANS_PER_FULL_TURN * turns));
}

/** How far the lobes have moved from the rest fan to the flanks: all the way by `1 / PSEUDOPOD_LEAN_GAIN` of `lean`. */
function flankShare(lean: number): number {
  return Math.min(1, lean * PSEUDOPOD_LEAN_GAIN);
}

/** Lobe `index`'s angle off the aim: its rest place in the skewed fan, moved toward its flank by `share`. */
function lobeOffset(index: number, count: number, share: number): number {
  const rest = REST_STEP * (index - (count - 1) * HALF) + REST_SKEW;
  const flank = Math.sign(rest) * (FLANK + PSEUDOPOD_FLANK_SPREAD * Math.abs(rest));
  return rest + (flank - rest) * share;
}

/** One moment of the fan: `cycleTurns` into the extension cycle, turned by `sway` off `aim`. */
interface FanMoment {
  readonly aim: number;
  readonly lean: number;
  readonly cycleTurns: number;
  readonly sway: number;
}

/** The lobes at one moment of the fan. */
function lobesAt(count: number, moment: FanMoment): ShapeBump[] {
  const sigma = pseudopodSigma(count);
  const share = flankShare(moment.lean);
  return Array.from({ length: count }, (_unused, index) => ({
    amplitude: PSEUDOPOD_REACH * extensionShare(moment.cycleTurns, index, count),
    centre: wrapAngle(moment.aim + moment.sway + lobeOffset(index, count, share)),
    sigma,
  }));
}

/** The frame's lobes: `count` bumps about `aim`, moving to the flanks and their sway fading with `lean`. */
export function pseudopodBumps(input: PseudopodInput): ShapeBump[] {
  if (input.count === 0) return [];
  const swayTurns = PSEUDOPOD_SWAY_HZ * input.timeSeconds + input.phase;
  const sway = SWAY * (1 - flankShare(input.lean)) * Math.sin(RADIANS_PER_FULL_TURN * swayTurns);
  const cycleTurns = PSEUDOPOD_CYCLE_HZ * input.timeSeconds + input.phase;
  return lobesAt(input.count, { aim: input.aim, lean: input.lean, cycleTurns, sway });
}

/** The table's angles: `Δ_k = k · 2π / N` off the aim, so `N / 2` is the rear. */
const TABLE_STEP = RADIANS_PER_FULL_TURN / PSEUDOPOD_PEAK_ANGLE_SAMPLES;
const HALF_TABLE_STEP = HALF * TABLE_STEP;
export const PSEUDOPOD_REAR_INDEX = PSEUDOPOD_PEAK_ANGLE_SAMPLES * HALF;

export function pseudopodTableAngle(index: number): number {
  return index * TABLE_STEP;
}

/**
 * What a peak between two time samples can add, per unit of summed reach: a lobe's share `R + (1 − R)(½ + ½ sin 2πu)`
 * curves by at most `(1 − R) / 2 · (2π)²` per cycle², so half a sample off it moves by at most `(h/2)² / 2` of that.
 */
const HALF_TIME_STEP = HALF / PSEUDOPOD_PEAK_TIME_SAMPLES;
const TIME_MISS_PER_REACH =
  HALF_TIME_STEP * HALF_TIME_STEP * HALF * REACHING_SHARE * HALF * RADIANS_PER_FULL_TURN * RADIANS_PER_FULL_TURN;

/** `Σ bumps(Δ)` at every table angle for one set of lobes. */
function sumAtTableAngles(bumps: readonly ShapeBump[]): number[] {
  return Array.from({ length: PSEUDOPOD_PEAK_ANGLE_SAMPLES }, (_unused, index) => {
    let sum = 0;
    for (const bump of bumps) {
      sum += gaussianBump(bump.amplitude, wrapAngle(pseudopodTableAngle(index) - bump.centre), bump.sigma).value;
    }
    return sum;
  });
}

/** Each entry the largest of its neighbours within `reach` table steps either side: the sway turning the fan. */
function dilate(values: readonly number[], reach: number): number[] {
  return values.map((_value, index) => {
    let widest = 0;
    for (let offset = -reach; offset <= reach; offset += 1) {
      widest = Math.max(widest, values[(index + offset + values.length) % values.length] ?? 0);
    }
    return widest;
  });
}

const tableCache = new Map<string, readonly number[]>();
const NO_LOBES: readonly number[] = new Array<number>(PSEUDOPOD_PEAK_ANGLE_SAMPLES).fill(0);

/**
 * The widest the lobes push the surface out at each table angle off the aim, over any frame at this `lean`, in
 * radii of the core: one extension cycle walked, the fan's sway taken as its whole swing (the phase only shifts the
 * cycle), with what the samples could miss in time and in angle added so it stays a bound. The reach bounds weigh it
 * against the speed stretch angle by angle (`shape-terms.ts`), which is what lets a lobe on the flank count for less
 * than one at the stretched front. Memoised, since the preview and the cull ask for the same few leans every frame.
 */
export function pseudopodReachTable(count: number, lean: number): readonly number[] {
  if (count === 0) return NO_LOBES;
  const key = `${count}:${lean}`;
  const cached = tableCache.get(key);
  if (cached !== undefined) return cached;
  let widest: number[] = new Array<number>(PSEUDOPOD_PEAK_ANGLE_SAMPLES).fill(0);
  for (let sample = 0; sample < PSEUDOPOD_PEAK_TIME_SAMPLES; sample += 1) {
    const cycleTurns = sample / PSEUDOPOD_PEAK_TIME_SAMPLES;
    const sums = sumAtTableAngles(lobesAt(count, { aim: 0, lean, cycleTurns, sway: 0 }));
    widest = widest.map((value, index) => Math.max(value, sums[index] ?? 0));
  }
  const sigma = pseudopodSigma(count);
  const angleMiss = HALF_TABLE_STEP * HALF_TABLE_STEP * HALF * ((count * PSEUDOPOD_REACH) / (sigma * sigma));
  const margin = angleMiss + TIME_MISS_PER_REACH * count * PSEUDOPOD_REACH;
  const swaySteps = Math.ceil((SWAY * (1 - flankShare(lean))) / TABLE_STEP);
  const table = dilate(widest, swaySteps).map((value) => value + margin);
  tableCache.set(key, table);
  return table;
}

/** The body's widest radius and its radius at the rear, in radii, before the pulse and the halo. */
export interface BodyReach {
  readonly widest: number;
  readonly rear: number;
}

const reachCache = new Map<string, BodyReach>();

/**
 * The amoeba body's reach over any frame: the core, times the stretch **at each angle**, times the surface there —
 * `surface` (every other term at its peak) plus the lobes' reach table at that angle. Weighing the two angle by angle
 * rather than multiplying their peaks is what keeps the bound tight: the lobes sit on the flanks while the stretch
 * pushes the front. The rear is the same product at `Δ = π`, where `flagellumSpec` roots a tail.
 */
export function amoebaBodyReach(count: number, lean: number, stretch: StretchTerm, surface: number): BodyReach {
  const key = `${count}:${lean}:${stretch.k}:${stretch.axialAlong}:${stretch.axialAcross}:${surface}`;
  const cached = reachCache.get(key);
  if (cached !== undefined) return cached;
  const table = pseudopodReachTable(count, lean);
  const reachAtIndex = (index: number): number =>
    AMOEBA_CORE_SCALE * stretchAt(stretch, pseudopodTableAngle(index)).value * (surface + (table[index] ?? 0));
  let widest = 0;
  for (let index = 0; index < table.length; index += 1) widest = Math.max(widest, reachAtIndex(index));
  const reach = { widest, rear: reachAtIndex(PSEUDOPOD_REAR_INDEX) };
  reachCache.set(key, reach);
  return reach;
}
