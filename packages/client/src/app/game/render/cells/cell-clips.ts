// The clip hooks (docs/RENDERING.md §4, §2.1): sampling a sheet-03 clip's tracks at a position,
// and turning the tracks a cell is playing into its `CellDeformation` — the eat dimple and wrap at
// the mote, the engulf arms, notch and seal at the prey (from `engulfProgress`, never the clock),
// the predator's seal relaxing from the ghost's `absorbed` clip, the pulse of level-up / respawn /
// eat and the respawn alpha. Pure; slice C (#207) owns the player that decides which clips run.

import { MOTION_CLIPS, sampleTrack, type MotionClip } from '@evolution/shared';
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

export type ClipTrackValues = Readonly<Record<string, number>>;

/** What a cell's running clips say this frame, with the angles the bumps aim at (cell frame, radians). */
export interface CellClipInput {
  /** The merged tracks of every millisecond clip the cell is playing. */
  readonly tracks: ClipTrackValues;
  /** Where the eaten mote was, held through the `eat` clip; `null` when no eat plays. */
  readonly moteAngle: number | null;
  /** Where the engulfed prey is; `null` when the cell is not engulfing. */
  readonly preyAngle: number | null;
  /** The prey's `engulfProgress`; `null` when the cell is not engulfing. */
  readonly engulfProgress: number | null;
  /** The `absorbed` clip's `seal` from the ghost this cell just absorbed; `null` otherwise. */
  readonly absorbedSeal: number | null;
}

export const REST_CLIP_INPUT: CellClipInput = {
  tracks: {},
  moteAngle: null,
  preyAngle: null,
  engulfProgress: null,
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

/** The arms at ±30°, the notch and the seal at the prey angle, from `engulfProgress` (VISUAL-STYLE §5). */
function engulfBumps(input: CellClipInput): ShapeBump[] {
  if (input.preyAngle === null || input.engulfProgress === null) return [];
  const tracks = sampleClipTracks(MOTION_CLIPS.engulf, input.engulfProgress);
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
  return {
    bumps,
    pulse: input.tracks['pulse'] ?? REST_PULSE,
    alpha: input.tracks['alpha'] ?? FULL_ALPHA,
  };
}
