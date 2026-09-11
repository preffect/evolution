// View + t → the profile terms of docs/RENDERING.md §2.1 and the eight bump slots: the resolved
// heading, the speed stretch, the sprint's axial stretch, breathing, the stage wobble, the strip's
// jitter and lobes, and the cell's deformation record (its bumps padded to `MAX_SHAPE_BUMPS`, its
// pulse). Also the per-instance maximum reach the quad extent needs (§2).

import { RADIANS_PER_FULL_TURN, type CellView } from '@evolution/shared';
import {
  BREATH_AMPLITUDE,
  BREATH_HZ,
  HALO_KIND,
  HALO_OUTER_RADII,
  JITTER_AMPLITUDE,
  MAX_SHAPE_BUMPS,
  PROTOCELL_HALO_OUTER_RADII,
  REST_LOBE_AMPLITUDE_MAX,
  SPRINT_STRETCH_SCALE,
  STRETCH_ACROSS_PER_ALONG,
  STRETCH_ALONG,
  STRETCH_TAPER,
} from '../constants';
import { gaussianBump, wrapAngle } from '../geometry';
import type { NoiseStrip } from '../noise/noise-strip';
import type { CellDeformation } from './cell-deformation';
import type { CellTraitSummary } from './cell-traits';
import { ZERO_BUMP, type RadialProfileTerms, type ShapeBump, type StretchTerm, type StripTerm } from './radial-profile';

/** The strip's lobes at full amplitude; `cytoskeleton` halves them with #216. */
const FULL_LOBES = 1;

export interface ShapeTermsInput {
  readonly view: Pick<CellView, 'radius' | 'velocityX' | 'velocityY' | 'sprintRemainingTicks'>;
  readonly traits: CellTraitSummary;
  readonly timeSeconds: number;
  readonly speedRatio: number;
  /** The heading resolved for this frame (`headingOf`: the velocity's, or the held one at rest), radians. */
  readonly heading: number;
  /** Cosmetic phase in turns and the strip row, from the cell's cosmetic fork. */
  readonly phase: number;
  readonly stripRow: number;
  readonly strip: NoiseStrip | null;
  /** This cell's bumps and pulse this frame (cell-deformation.ts). */
  readonly deformation: CellDeformation;
}

export interface ShapeTerms extends RadialProfileTerms {
  /** Exactly `MAX_SHAPE_BUMPS` slots, zero-amplitude where unused. */
  readonly bumps: readonly ShapeBump[];
  /** The halo's outer radius for this cell's halo kind. */
  readonly haloOuterRadii: number;
  /** The per-instance maximum reach in radii: pulse × stretch × surface × halo (§2). */
  readonly maxRadii: number;
  readonly isSprinting: boolean;
}

const HALO_OUTER_BY_KIND: Readonly<Record<number, number>> = {
  [HALO_KIND.default]: HALO_OUTER_RADII,
  [HALO_KIND.protocell]: PROTOCELL_HALO_OUTER_RADII,
};

/** The bumps padded (or cut) to exactly `MAX_SHAPE_BUMPS` slots. */
export function assignBumpSlots(bumps: readonly ShapeBump[]): ShapeBump[] {
  return Array.from({ length: MAX_SHAPE_BUMPS }, (_unused, slot) => bumps[slot] ?? ZERO_BUMP);
}

/** The largest positive bump sum, evaluated at every bump centre (neighbouring bumps overlap). */
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

/** `atan2(velocityY, velocityX)` while moving; the held heading at rest. */
export function headingOf(view: Pick<CellView, 'velocityX' | 'velocityY'>, speedRatio: number, held: number): number {
  return speedRatio > 0 ? Math.atan2(view.velocityY, view.velocityX) : held;
}

/** The per-instance maximum reach in radii: pulse × stretch × surface × halo (§2). */
export function maxReachRadii(terms: RadialProfileTerms, haloOuterRadii: number): number {
  const { stretch, wobble } = terms;
  const stretchMax =
    Math.max(1, 1 + stretch.k * (stretch.along - 1)) * Math.max(1, stretch.axialAlong, stretch.axialAcross);
  const stripMax = terms.strip ? terms.strip.jitterAmplitude + terms.strip.lobesScale * REST_LOBE_AMPLITUDE_MAX : 0;
  const surfaceMax = 1 + Math.abs(terms.breathing) + wobble.amplitude + stripMax + bumpPeak(terms.bumps);
  return terms.pulse * stretchMax * surfaceMax * haloOuterRadii;
}

function stretchTerm(speedRatio: number, isSprinting: boolean): StretchTerm {
  return {
    k: speedRatio,
    along: STRETCH_ALONG,
    taper: STRETCH_TAPER,
    acrossPerAlong: STRETCH_ACROSS_PER_ALONG,
    axialAlong: isSprinting ? SPRINT_STRETCH_SCALE : 1,
    axialAcross: 1,
  };
}

function stripTerm(input: ShapeTermsInput): StripTerm | null {
  if (input.strip === null) return null;
  return {
    strip: input.strip,
    row: input.stripRow,
    phase: input.phase,
    jitterAmplitude: JITTER_AMPLITUDE,
    lobesScale: FULL_LOBES,
  };
}

/** Builds the frame's profile terms for one cell. */
export function buildShapeTerms(input: ShapeTermsInput): ShapeTerms {
  const { traits, timeSeconds } = input;
  const isSprinting = input.view.sprintRemainingTicks > 0;
  const haloOuterRadii = HALO_OUTER_BY_KIND[traits.haloKind] ?? HALO_OUTER_RADII;
  const terms: RadialProfileTerms = {
    radius: input.view.radius,
    pulse: input.deformation.pulse,
    heading: input.heading,
    breathing: BREATH_AMPLITUDE * Math.sin(RADIANS_PER_FULL_TURN * (BREATH_HZ * timeSeconds + input.phase)),
    wobble: {
      amplitude: traits.wobble.amplitude,
      mode: traits.wobble.mode,
      phase: RADIANS_PER_FULL_TURN * (traits.wobble.hz * timeSeconds + input.phase),
    },
    strip: stripTerm(input),
    stretch: stretchTerm(input.speedRatio, isSprinting),
    bumps: assignBumpSlots(input.deformation.bumps),
  };
  return { ...terms, haloOuterRadii, maxRadii: maxReachRadii(terms, haloOuterRadii), isSprinting };
}
