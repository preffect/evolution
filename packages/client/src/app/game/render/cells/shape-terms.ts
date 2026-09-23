// View + t → the profile terms of docs/rendering/cells.md §2.1 and the eight bump slots: the resolved
// heading, the form, the speed stretch, the sprint's axial stretch, breathing, the stage wobble,
// the strip's jitter and lobes (halved by `cytoskeleton`, zero on a rigid form), and the cell's
// deformation record (its bumps padded to `MAX_SHAPE_BUMPS`, its pulse). Also the per-instance
// maximum reach the quad extent needs (§2).

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
  TRAIT_HALO_OUTER_RADII,
  WOBBLE_TAUT_SCALE,
} from '../constants';
import { gaussianBump, wrapAngle } from '../geometry';
import type { NoiseStrip } from '../noise/noise-strip';
import type { CellDeformation } from './cell-deformation';
import type { CellTraitSummary } from './cell-traits';
import {
  ZERO_BUMP,
  stretchAt,
  type RadialProfileTerms,
  type ShapeBump,
  type StretchTerm,
  type StripTerm,
} from './radial-profile';

/** The rest motion at full amplitude; `cytoskeleton` halves breathing and lobes, a rigid form zeroes all three. */
const FULL = 1;
const STILL = 0;

interface RestScales {
  readonly breathing: number;
  readonly lobes: number;
  readonly jitter: number;
}

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
  [HALO_KIND.chloroplast]: TRAIT_HALO_OUTER_RADII,
  [HALO_KIND.toxin]: TRAIT_HALO_OUTER_RADII,
  [HALO_KIND.protocell]: PROTOCELL_HALO_OUTER_RADII,
};

/** The bumps padded (or cut) to exactly `MAX_SHAPE_BUMPS` slots. */
export function assignBumpSlots(bumps: readonly ShapeBump[]): ShapeBump[] {
  return Array.from({ length: MAX_SHAPE_BUMPS }, (_unused, slot) => bumps[slot] ?? ZERO_BUMP);
}

/** The largest positive bump sum, evaluated at every bump centre (neighbouring bumps overlap). */
export function bumpPeak(bumps: readonly ShapeBump[]): number {
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

/** The halo's outer radius for a cell's halo kind, in radii. */
export function haloOuterRadiiOf(traits: CellTraitSummary): number {
  return HALO_OUTER_BY_KIND[traits.haloKind] ?? HALO_OUTER_RADII;
}

/** The widest the stretch scales a radius: the speed stretch along the heading, times the sprint's axial scale. */
function stretchReach(stretch: StretchTerm): number {
  return Math.max(1, 1 + stretch.k * (stretch.along - 1)) * Math.max(1, stretch.axialAlong, stretch.axialAcross);
}

/** The most the noise strip can push the surface out, in radii: its jitter plus its deepest rest lobe. */
function stripReach(jitterAmplitude: number, lobesScale: number): number {
  return jitterAmplitude + lobesScale * REST_LOBE_AMPLITUDE_MAX;
}

/** The surface's widest radius fraction: the unit membrane plus everything that pushes it outward. */
function surfaceReach(breathing: number, wobbleAmplitude: number, strip: number, bumps: number): number {
  return 1 + breathing + wobbleAmplitude + strip + bumps;
}

/** The per-instance maximum reach in radii: pulse × stretch × surface × halo (§2). */
export function maxReachRadii(terms: RadialProfileTerms, haloOuterRadii: number): number {
  const stripMax = terms.strip ? stripReach(terms.strip.jitterAmplitude, terms.strip.lobesScale) : 0;
  const surfaceMax = surfaceReach(Math.abs(terms.breathing), terms.wobble.amplitude, stripMax, bumpPeak(terms.bumps));
  return terms.pulse * stretchReach(terms.stretch) * surfaceMax * haloOuterRadii;
}

/**
 * What a cell's running motion clips add to its reach at their widest (`cell-clips.ts`'s `clipDeformationPeak`).
 * A cell playing nothing wears `REST_CLIP_PEAK`.
 */
export interface ClipDeformationPeak {
  /** The largest `pulse` the clips reach; 1 at rest. */
  readonly pulse: number;
  /** The largest positive bump sum the clips push the surface out by, in radii; 0 at rest. */
  readonly bumpRadii: number;
}

/** A cell playing no clip and bumped into by nothing. */
export const REST_CLIP_PEAK: ClipDeformationPeak = { pulse: 1, bumpRadii: 0 };

/**
 * The largest reach any frame of a cell with these traits can produce, in radii — the same
 * `maxReachRadii`, with the one term it **samples** rather than bounds (the breathing sine) at its own peak, and
 * with the clips it plays at theirs.
 *
 * It takes no time and no cosmetic fork, so it is a constant of the cell rather than of the frame. That is what
 * the encyclopedia preview frames its lens by (`preview/scenes/cell-scene.ts`): a view radius read off a sampled
 * reach would breathe the zoom in and out with the membrane.
 *
 * **`clip` is not optional by accident.** Ticket #363's scenes played no clip, so a default of `REST_CLIP_PEAK`
 * would have been right for every caller that existed — and then silently wrong for the first action scene, whose
 * eat clip pulses the membrane to 1.09 and wraps it 0.14 further. A caller that plays no clip says so.
 */
export function peakReachRadii(
  traits: CellTraitSummary,
  speedRatio: number,
  isSprinting: boolean,
  clip: ClipDeformationPeak,
): number {
  const stretch = stretchReach(stretchTerm(speedRatio, isSprinting));
  return clip.pulse * stretch * peakSurfaceReach(traits, clip) * haloOuterRadiiOf(traits);
}

/**
 * The largest the membrane **at the rear** (`heading + π`) can be, in radii: where `cell-layer.ts`'s
 * `flagellumSpec` roots the tail. The same peak as `peakReachRadii` with the stretch taken at the rear, where the
 * speed stretch tapers it, and without the halo — the tail hangs off the membrane, not the glow around it.
 */
export function peakRearMembraneRadii(
  traits: CellTraitSummary,
  speedRatio: number,
  isSprinting: boolean,
  clip: ClipDeformationPeak,
): number {
  const rearStretch = stretchAt(stretchTerm(speedRatio, isSprinting), Math.PI).value;
  return clip.pulse * rearStretch * peakSurfaceReach(traits, clip);
}

/** The surface's widest radius fraction over any frame: breathing at its peak, plus the clips' bumps. */
function peakSurfaceReach(traits: CellTraitSummary, clip: ClipDeformationPeak): number {
  const scales = restScales(traits);
  return surfaceReach(
    scales.breathing * BREATH_AMPLITUDE,
    traits.wobble.amplitude,
    stripReach(JITTER_AMPLITUDE * scales.jitter, scales.lobes),
    clip.bumpRadii,
  );
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

/** Breathing and lobes halve when taut (visual-style/motion-and-legibility.md §5); a rigid valve does not breathe, jitter or lobe (§2.4). */
function restScales(traits: CellTraitSummary): RestScales {
  if (traits.form.isRigid) return { breathing: STILL, lobes: STILL, jitter: STILL };
  const taut = traits.isTaut ? WOBBLE_TAUT_SCALE : FULL;
  return { breathing: taut, lobes: taut, jitter: FULL };
}

function stripTerm(input: ShapeTermsInput, scales: RestScales): StripTerm | null {
  if (input.strip === null) return null;
  return {
    strip: input.strip,
    row: input.stripRow,
    phase: input.phase,
    jitterAmplitude: JITTER_AMPLITUDE * scales.jitter,
    lobesScale: scales.lobes,
  };
}

/** Builds the frame's profile terms for one cell. */
export function buildShapeTerms(input: ShapeTermsInput): ShapeTerms {
  const { traits, timeSeconds } = input;
  const isSprinting = input.view.sprintRemainingTicks > 0;
  const haloOuterRadii = haloOuterRadiiOf(traits);
  const scales = restScales(traits);
  const terms: RadialProfileTerms = {
    radius: input.view.radius,
    pulse: input.deformation.pulse,
    heading: input.heading,
    form: traits.form.profileAt(traits.formTier),
    breathing:
      scales.breathing * BREATH_AMPLITUDE * Math.sin(RADIANS_PER_FULL_TURN * (BREATH_HZ * timeSeconds + input.phase)),
    wobble: {
      amplitude: traits.wobble.amplitude,
      mode: traits.wobble.mode,
      phase: RADIANS_PER_FULL_TURN * (traits.wobble.hz * timeSeconds + input.phase),
    },
    strip: stripTerm(input, scales),
    stretch: stretchTerm(input.speedRatio, isSprinting),
    bumps: assignBumpSlots(input.deformation.bumps),
  };
  return { ...terms, haloOuterRadii, maxRadii: maxReachRadii(terms, haloOuterRadii), isSprinting };
}
