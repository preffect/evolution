// The clip hooks (docs/rendering/contents-and-motion.md §4, docs/rendering/cells.md §2.1): sampling a sheet-03 clip's tracks at a position,
// and turning the tracks a cell is playing into its `CellDeformation` — the eat dimple and wrap at
// the mote, the engulf arms, notch and seal at the prey (from `engulfProgress` remapped onto the clip, never the clock),
// the predator's seal relaxing from the ghost's `absorbed` clip, the pulse of level-up / respawn /
// eat and the respawn alpha. Pure; slice C (#207) owns the player that decides which clips run.

import { ENGULF_CLIP_SEAL_AT, MOTION_CLIPS, sampleTrack, type MotionClip, type MotionClipId } from '@evolution/shared';
import {
  EAT_DIMPLE_SIGMA_DEG,
  EAT_WRAP_SIGMA_DEG,
  ENGULF_ARM_OFFSET_DEG,
  ENGULF_ARM_SIGMA_DEG,
  ENGULF_NOTCH_SIGMA_DEG,
  ENGULF_SEAL_SIGMA_DEG,
} from '../constants';
import { ease } from '../easing';
import { degreesToRadians } from '../geometry';
import type { ShapeBump } from './radial-profile';
import type { CellDeformation } from './cell-deformation';
import { bumpPeak, type ClipDeformationPeak } from './shape-terms';

export type ClipTrackValues = Readonly<Record<string, number>>;

/** What a cell's running clips say this frame, with the angles the bumps aim at (cell frame, radians). */
export interface CellClipInput {
  /** The merged tracks of every millisecond clip the cell is playing. */
  readonly tracks: ClipTrackValues;
  /** Where the eaten mote was, held through the `eat` clip; `null` when no eat plays. */
  readonly moteAngle: number | null;
  /** Where the engulfed prey is; `null` when the cell is not engulfing. */
  readonly preyAngle: number | null;
  /** Where on the `engulf` clip the prey's progress falls (`engulfClipPosition`); `null` when the cell is not engulfing. */
  readonly engulfClipPosition: number | null;
  /** The `absorbed` clip's `seal` from the ghost this cell just absorbed; `null` otherwise. */
  readonly absorbedSeal: number | null;
}

export const REST_CLIP_INPUT: CellClipInput = {
  tracks: {},
  moteAngle: null,
  preyAngle: null,
  engulfClipPosition: null,
  absorbedSeal: null,
};

const EAT_DIMPLE_SIGMA = degreesToRadians(EAT_DIMPLE_SIGMA_DEG);
const EAT_WRAP_SIGMA = degreesToRadians(EAT_WRAP_SIGMA_DEG);
const ARM_OFFSET = degreesToRadians(ENGULF_ARM_OFFSET_DEG);
const ARM_SIGMA = degreesToRadians(ENGULF_ARM_SIGMA_DEG);
const NOTCH_SIGMA = degreesToRadians(ENGULF_NOTCH_SIGMA_DEG);
const SEAL_SIGMA = degreesToRadians(ENGULF_SEAL_SIGMA_DEG);
const REST_PULSE = 1;
const FULL_ALPHA = 1;
const ENGULF_CLIP = MOTION_CLIPS.engulf;
/** `engulfProgress` at the payout. */
const COMPLETE_PROGRESS = 1;

/** Every track of `clip` at `position` (ms or progress, per the clip's domain). */
export function sampleClipTracks(clip: MotionClip, position: number): ClipTrackValues {
  const values: Record<string, number> = {};
  for (const [name, track] of Object.entries(clip.tracks)) values[name] = sampleTrack(track, position, ease);
  return values;
}

function bump(amplitude: number, centre: number, sigma: number): ShapeBump {
  return { amplitude, centre, sigma };
}

/** The eat dimple and wrap toward the mote (sheet 03 strip A). */
function eatBumps(input: CellClipInput): ShapeBump[] {
  if (input.moteAngle === null) return [];
  const dimple = input.tracks['dimple'] ?? 0;
  const wrap = input.tracks['wrap'] ?? 0;
  return [bump(dimple, input.moteAngle, EAT_DIMPLE_SIGMA), bump(wrap, input.moteAngle, EAT_WRAP_SIGMA)];
}

/**
 * Where on the `engulf` clip a prey's `engulfProgress` falls (docs/rendering/contents-and-motion.md §4, ticket #703):
 * piecewise linear, sending the room's `engulfSealProgress` to `ENGULF_CLIP_SEAL_AT`, so the arms peak and the seal
 * starts where the simulation seals even under a patched phase second. The identity at the default seal of 0.5.
 */
export function engulfClipPosition(engulfProgress: number, sealProgress: number): number {
  if (engulfProgress < sealProgress) return (engulfProgress / sealProgress) * ENGULF_CLIP_SEAL_AT;
  const absorbBandWidth = COMPLETE_PROGRESS - sealProgress;
  if (absorbBandWidth <= 0) return ENGULF_CLIP.duration;
  const absorbShare = (engulfProgress - sealProgress) / absorbBandWidth;
  return ENGULF_CLIP_SEAL_AT + absorbShare * (ENGULF_CLIP.duration - ENGULF_CLIP_SEAL_AT);
}

/** The arms at ±30°, the notch and the seal at the prey angle, from the clip position (visual-style/motion-and-legibility.md §5). */
function engulfBumps(input: CellClipInput): ShapeBump[] {
  if (input.preyAngle === null || input.engulfClipPosition === null) return [];
  const tracks = sampleClipTracks(ENGULF_CLIP, input.engulfClipPosition);
  const arm = tracks['arm'] ?? 0;
  return [
    bump(arm, input.preyAngle + ARM_OFFSET, ARM_SIGMA),
    bump(arm, input.preyAngle - ARM_OFFSET, ARM_SIGMA),
    bump(tracks['notch'] ?? 0, input.preyAngle, NOTCH_SIGMA),
    bump(tracks['seal'] ?? 0, input.preyAngle, SEAL_SIGMA),
  ];
}

/** The seal bulge relaxing after payout, driven by the ghost's clip (the predator's `engulfProgress` is gone). */
function absorbedSealBump(input: CellClipInput): ShapeBump[] {
  if (input.absorbedSeal === null || input.preyAngle === null) return [];
  return [bump(input.absorbedSeal, input.preyAngle, SEAL_SIGMA)];
}

/** The clips' contribution to the profile (§2.1 slot rule: an engulf drops the eat bumps; the eat `pulse` still plays). */
export function clipDeformation(input: CellClipInput): CellDeformation {
  const isEngulfing = input.preyAngle !== null;
  const bumps = isEngulfing ? [...engulfBumps(input), ...absorbedSealBump(input)] : eatBumps(input);
  const deformation: CellDeformation = {
    bumps,
    pulse: input.tracks['pulse'] ?? REST_PULSE,
    alpha: input.tracks['alpha'] ?? FULL_ALPHA,
  };
  return input.preyAngle === null || input.engulfClipPosition === null
    ? deformation
    : { ...deformation, preyAngle: input.preyAngle };
}

/**
 * How widely `clipId` can deform a cell, over the whole clip — what the encyclopedia preview frames its lens by
 * when a scene plays that clip (`cells/cell-draw-extent.ts`, ticket #364).
 *
 * It **samples the real `clipDeformation`** rather than reading the clip's keyframes: the tracks reach the
 * surface through `eatBumps` and `engulfBumps`, which place them at sigmas and pair them up, so a peak taken off
 * the keyframes would be a different number from the one drawn. Retuning `EAT_WRAP_SIGMA_DEG` or the bump
 * pairing therefore moves this, as it should.
 *
 * Sampled because the tracks are eased between keyframes and two bumps can overlap: the widest sum need not land
 * on a keyframe. The step is fine enough that the miss is far under the framing margin, and `cell-clips.spec.ts`
 * pins the peak against a much finer walk.
 */
export function clipDeformationPeak(clipId: MotionClipId, context: ClipPeakContext): ClipDeformationPeak {
  const clip = MOTION_CLIPS[clipId];
  return peakOverWalk((share) => ({
    ...REST_CLIP_INPUT,
    ...context,
    tracks: sampleClipTracks(clip, share * clip.duration),
  }));
}

/** The widest pulse and bump sum `clipDeformation` reaches over `inputAt(0..1)`, sampled at `CLIP_PEAK_SAMPLES`. */
function peakOverWalk(inputAt: (share: number) => CellClipInput): ClipDeformationPeak {
  let pulse = REST_PULSE;
  let bumpRadii = 0;
  for (let step = 0; step <= CLIP_PEAK_SAMPLES; step += 1) {
    const deformation = clipDeformation(inputAt(step / CLIP_PEAK_SAMPLES));
    pulse = Math.max(pulse, deformation.pulse);
    bumpRadii = Math.max(bumpRadii, bumpPeak(deformation.bumps));
  }
  return { pulse, bumpRadii };
}

/**
 * Which bumps a clip's tracks become depends on where the thing it reacts to is — `clipDeformation` places the
 * eat bumps at `moteAngle` and the engulf bumps around `preyAngle`, and drops one set when the other applies. The
 * **angles** do not change the peak (the bumps are the same size wherever they point), but whether they are
 * `null` decides which set exists at all, so a caller says which case it is asking about.
 */
export type ClipPeakContext = Pick<CellClipInput, 'moteAngle' | 'preyAngle' | 'absorbedSeal'>;

/** A cell eating: the bumps aim at the mote. Any angle gives the same peak. */
export const EATING_CLIP_CONTEXT: ClipPeakContext = { moteAngle: 0, preyAngle: null, absorbedSeal: null };
/** A cell playing a clip that deforms nothing directionally — a level-up or a respawn pulse. */
export const UNAIMED_CLIP_CONTEXT: ClipPeakContext = { moteAngle: null, preyAngle: null, absorbedSeal: null };

/**
 * How widely an engulf can deform the **predator**, over the whole of `engulfProgress` — the arms, the notch and
 * the seal at their widest sum (ticket #364's two-cell scenes frame their lens by it).
 *
 * Its own walk rather than `clipDeformationPeak(MOTION_CLIP.engulf, …)`: the engulf is the one clip driven by
 * progress instead of the clock, so `engulfBumps` samples `MOTION_CLIPS.engulf` at `input.engulfClipPosition` and
 * reads nothing from `tracks`. Fed through the clock walk it would report a round cell.
 */
export function engulfDeformationPeak(): ClipDeformationPeak {
  return peakOverWalk((share) => ({
    ...REST_CLIP_INPUT,
    preyAngle: ENGULF_PEAK_PREY_ANGLE,
    engulfClipPosition: share * ENGULF_CLIP.duration,
  }));
}

/** The bumps are the same size wherever the prey is; any angle gives the peak. */
const ENGULF_PEAK_PREY_ANGLE = 0;

/** Enough steps that an eased peak between keyframes is not missed; `cell-clips.spec.ts` pins it against 20×. */
const CLIP_PEAK_SAMPLES = 240;
