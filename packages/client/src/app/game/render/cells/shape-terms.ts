// View + clips + t → the profile terms of docs/RENDERING.md §2.1 and the eight bump slots: every
// deformation is a row here, never a branch in the shader.

import { RADIANS_PER_FULL_TURN, type CellView } from '@evolution/shared';
import {
  BREATH_AMPLITUDE,
  BREATH_HZ,
  CONTACT_DENT_SIGMA_DEG,
  CONTACT_DENT_TAUT_SIGMA_DEG,
  EAT_DIMPLE_SIGMA_DEG,
  EAT_WRAP_SIGMA_DEG,
  ENGULF_ARM_OFFSET_DEG,
  ENGULF_ARM_SIGMA_DEG,
  ENGULF_NOTCH_SIGMA_DEG,
  ENGULF_SEAL_SIGMA_DEG,
  HALO_KIND,
  HALO_OUTER_RADII,
  JITTER_AMPLITUDE,
  MAX_SHAPE_BUMPS,
  PROTOCELL_HALO_OUTER_RADII,
  PSEUDOPOD_SLOT_COUNT,
  REST_LOBE_AMPLITUDE_MAX,
  STRETCH_ACROSS_PER_ALONG,
  STRETCH_ALONG,
  STRETCH_TAPER,
  TRAIT_HALO_OUTER_RADII,
  WOBBLE_TAUT_SCALE,
} from '../constants';
import { degreesToRadians, gaussianBump, wrapAngle } from '../geometry';
import type { NoiseStrip } from '../noise/noise-strip';
import type { CellTraitSummary } from './cell-traits';
import type { FormProfile, RadialProfileTerms, ShapeBump, StretchTerm, StripTerm } from './radial-profile';

export const ZERO_BUMP: ShapeBump = { amplitude: 0, centre: 0, sigma: 1 };

/** The clip tracks that reach the profile, already sampled at this frame. */
export interface ShapeClipValues {
  readonly eat: { dimple: number; wrap: number; pulse: number; stretchAlong: number; stretchAcross: number } | null;
  readonly engulf: { arm: number; notch: number; seal: number } | null;
  /** The predator's seal from the ghost's `absorbed` clip once its `engulfProgress` is gone (§2.3). */
  readonly absorbedSeal: number | null;
  /** `level_up` / `respawn` pulses, 1 when idle. */
  readonly pulse: number;
  /** 1.06 while sprinting, easing back through `sprint_release`. */
  readonly sprintStretch: number;
}

export interface ShapeTermsInput {
  readonly view: Pick<CellView, 'radius' | 'velocityX' | 'velocityY'>;
  readonly traits: CellTraitSummary;
  readonly timeSeconds: number;
  readonly speedRatio: number;
  /** The heading held from the last moving frame (radians). */
  readonly heldHeading: number;
  /** Cosmetic phase in turns and the strip row, from the cell's cosmetic fork. */
  readonly phase: number;
  readonly stripRow: number;
  readonly strip: NoiseStrip | null;
  readonly clips: ShapeClipValues;
  /** Angle to the prey (engulfing) and to the eaten mote (eat clip), cell frame. */
  readonly preyAngle: number | null;
  readonly moteAngle: number | null;
  readonly contactDent: ShapeBump | null;
  readonly pseudopods: readonly ShapeBump[];
  readonly form: FormProfile | null;
}

export interface ShapeTerms extends RadialProfileTerms {
  /** Exactly `MAX_SHAPE_BUMPS` slots, zero-amplitude where unused. */
  readonly bumps: readonly ShapeBump[];
  /** The halo's outer radius for this cell's halo kind. */
  readonly haloOuterRadii: number;
  /** The per-instance maximum reach in radii: pulse × stretch × surface × halo (§2). */
  readonly maxRadii: number;
  readonly isEngulfing: boolean;
}

const HALO_OUTER_BY_KIND: Readonly<Record<number, number>> = {
  [HALO_KIND.default]: HALO_OUTER_RADII,
  [HALO_KIND.trait]: TRAIT_HALO_OUTER_RADII,
  [HALO_KIND.protocell]: PROTOCELL_HALO_OUTER_RADII,
};

function bump(amplitude: number, centre: number, sigmaDeg: number): ShapeBump {
  return { amplitude, centre: wrapAngle(centre), sigma: degreesToRadians(sigmaDeg) };
}

function engulfSlots(input: ShapeTermsInput): ShapeBump[] {
  const prey = input.preyAngle ?? input.heldHeading;
  const engulf = input.clips.engulf ?? { arm: 0, notch: 0, seal: 0 };
  const seal = input.clips.absorbedSeal ?? engulf.seal;
  const offset = degreesToRadians(ENGULF_ARM_OFFSET_DEG);
  return [
    bump(engulf.arm, prey + offset, ENGULF_ARM_SIGMA_DEG),
    bump(engulf.arm, prey - offset, ENGULF_ARM_SIGMA_DEG),
    bump(engulf.notch, prey, ENGULF_NOTCH_SIGMA_DEG),
    bump(seal, prey, ENGULF_SEAL_SIGMA_DEG),
  ];
}

function restSlots(input: ShapeTermsInput): ShapeBump[] {
  const mote = input.moteAngle ?? input.heldHeading;
  const eat = input.clips.eat;
  const dent = input.contactDent;
  const dentSigma = input.traits.isTaut ? CONTACT_DENT_TAUT_SIGMA_DEG : CONTACT_DENT_SIGMA_DEG;
  return [
    eat ? bump(eat.dimple, mote, EAT_DIMPLE_SIGMA_DEG) : ZERO_BUMP,
    eat ? bump(eat.wrap, mote, EAT_WRAP_SIGMA_DEG) : ZERO_BUMP,
    dent ? bump(dent.amplitude, dent.centre, dentSigma) : ZERO_BUMP,
    ZERO_BUMP,
  ];
}

/** The slot rule of §2.1: while engulfing, contact and eat bumps are dropped; pseudopods keep the last four. */
export function assignBumpSlots(input: ShapeTermsInput, isEngulfing: boolean): ShapeBump[] {
  const shared = isEngulfing ? engulfSlots(input) : restSlots(input);
  const pseudopods = Array.from(
    { length: PSEUDOPOD_SLOT_COUNT },
    (_unused, index) => input.pseudopods[index] ?? ZERO_BUMP,
  );
  return [...shared, ...pseudopods].slice(0, MAX_SHAPE_BUMPS);
}

/** The largest positive bump sum, evaluated at every bump centre (the arms overlap at ±30°). */
function bumpPeak(bumps: readonly ShapeBump[]): number {
  let peak = 0;
  for (const centreBump of bumps) {
    if (centreBump.amplitude <= 0) continue;
    let sum = 0;
    for (const other of bumps)
      sum += gaussianBump(other.amplitude, wrapAngle(centreBump.centre - other.centre), other.sigma).value;
    peak = Math.max(peak, sum);
  }
  return peak;
}

export function headingOf(view: Pick<CellView, 'velocityX' | 'velocityY'>, speedRatio: number, held: number): number {
  return speedRatio > 0 ? Math.atan2(view.velocityY, view.velocityX) : held;
}

/** The per-instance maximum reach in radii: pulse × stretch × surface × halo (§2). */
function maxReachRadii(terms: RadialProfileTerms, haloOuterRadii: number, taut: number): number {
  const { stretch, wobble } = terms;
  const stretchMax =
    Math.max(1, 1 + stretch.k * (stretch.along - 1)) * Math.max(1, stretch.axialAlong, stretch.axialAcross);
  const stripMax = terms.strip ? JITTER_AMPLITUDE + taut * REST_LOBE_AMPLITUDE_MAX : 0;
  const surfaceMax = 1 + Math.abs(terms.breathing) + wobble.amplitude + stripMax + bumpPeak(terms.bumps);
  return terms.pulse * stretchMax * surfaceMax * haloOuterRadii;
}

function stretchTerm(input: ShapeTermsInput): StretchTerm {
  const eat = input.clips.eat;
  return {
    k: input.speedRatio,
    along: STRETCH_ALONG,
    taper: STRETCH_TAPER,
    acrossPerAlong: STRETCH_ACROSS_PER_ALONG,
    axialAlong: (eat?.stretchAlong ?? 1) * input.clips.sprintStretch,
    axialAcross: eat?.stretchAcross ?? 1,
  };
}

function stripTerm(input: ShapeTermsInput, taut: number): StripTerm | null {
  if (!input.strip) return null;
  return {
    strip: input.strip,
    row: input.stripRow,
    phase: input.phase,
    jitterAmplitude: JITTER_AMPLITUDE,
    lobesScale: taut,
  };
}

/** Builds the frame's profile terms for one cell. */
export function buildShapeTerms(input: ShapeTermsInput): ShapeTerms {
  const { traits, clips, timeSeconds } = input;
  const taut = traits.isTaut ? WOBBLE_TAUT_SCALE : 1;
  const isEngulfing = clips.engulf !== null || clips.absorbedSeal !== null;
  const haloOuterRadii = HALO_OUTER_BY_KIND[traits.haloKind] ?? HALO_OUTER_RADII;
  const terms: RadialProfileTerms = {
    radius: input.view.radius,
    pulse: clips.pulse * (clips.eat?.pulse ?? 1),
    heading: headingOf(input.view, input.speedRatio, input.heldHeading),
    breathing: taut * BREATH_AMPLITUDE * Math.sin(RADIANS_PER_FULL_TURN * (BREATH_HZ * timeSeconds + input.phase)),
    wobble: {
      amplitude: traits.wobble.amplitude,
      mode: traits.wobble.mode,
      phase: RADIANS_PER_FULL_TURN * (traits.wobble.hz * timeSeconds + input.phase),
    },
    strip: stripTerm(input, taut),
    stretch: stretchTerm(input),
    bumps: assignBumpSlots(input, isEngulfing),
    form: input.form,
  };
  return { ...terms, haloOuterRadii, maxRadii: maxReachRadii(terms, haloOuterRadii, taut), isEngulfing };
}
