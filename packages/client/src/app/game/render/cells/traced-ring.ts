// The rings trace the outline (docs/visual-style/motion-and-legibility.md §5.1 rule 4, docs/rendering/cells.md §2.2,
// #730): the engulf-warning ring and the relation rings are their circle plus a **ring lobe** over every bump that
// pushes the membrane out (the amoeba's arms, an engulf's arms, an eat's wrap), so each keeps its gap from the outline
// instead of cutting across an arm. A ring lobe is the bump at its full height in world units, its σ widened so the
// ring clears the arm's flanks by the gap as well as its tip. Each lobe rides on the sum of every broader lobe, and the
// ring takes the tallest of those stacks: an arm on an engulf's broad seal swell stacks as the membrane does, while two
// arms of one width side by side leave a notch between them, as an offset curve would, instead of merging into one
// bulge past both tips. With no such bump the ring is its circle, exactly. The dash of
// the threat ring is measured along the traced curve: its circle's arc plus the extra length the lobes add. The TypeScript
// reference of `cell-shader-rings.ts`, term for term; the reach bounds for the quad, the cull and the labels read it.

import { RADIANS_PER_FULL_TURN, type CellView } from '@evolution/shared';
import { PSEUDOPOD_REACH, RING_TRACE_ARC_SAMPLES, RING_TRACE_SIGMA_WIDENING } from '../constants';
import { SQUARE_DERIVATIVE_FACTOR, wrapAngle } from '../geometry';
import { NO_EFFECT_REACH, type CellDrawState } from './cell-draw-extent';
import { summariseCellTraits, type CellTraitSummary } from './cell-traits';
import { pseudopodCount } from './forms/form-profiles';
import { stretchAt, type RadialProfileTerms } from './radial-profile';
import { REST_CLIP_PEAK, peakStretchRadii } from './shape-terms';

/** One lobe of a traced ring: its height past the circle in world units, its centre and its widened σ (radians). */
export interface RingLobe {
  readonly amplitudeWu: number;
  readonly centre: number;
  readonly sigma: number;
  /** The membrane bump's own σ: a lobe stacks on every lobe whose breadth is greater. */
  readonly breadth: number;
}

/** The traced ring's radius `R(θ)` and `R′(θ)`, world units. */
export interface TracedRingSample {
  readonly r: number;
  readonly derivative: number;
}

/** The membrane's core radius under `centre`, wu: `r · pulse · B · stretch` there, before the surface terms. */
function coreRadiusWu(terms: RadialProfileTerms, centre: number): number {
  const delta = wrapAngle(centre - terms.heading);
  const form = terms.form === null ? 1 : terms.form.evaluate(delta).value;
  return terms.radius * terms.pulse * form * stretchAt(terms.stretch, delta).value;
}

/** A lobe's σ widened for a ring `gapCores` core radii out: `√(σ² + RING_TRACE_SIGMA_WIDENING · ln(1 + g))`. */
export function widenedRingSigma(sigma: number, gapCores: number): number {
  return Math.sqrt(sigma * sigma + RING_TRACE_SIGMA_WIDENING * Math.log(1 + Math.max(gapCores, 0)));
}

/** The ring lobes of a ring of `ringRadiusWu` around a membrane with these terms: one per outward bump. */
export function ringLobesOf(terms: RadialProfileTerms, ringRadiusWu: number): RingLobe[] {
  return terms.bumps
    .filter((bump) => bump.amplitude > 0)
    .map((bump) => {
      const coreWu = coreRadiusWu(terms, bump.centre);
      const gapCores = (ringRadiusWu - coreWu) / coreWu;
      const sigma = widenedRingSigma(bump.sigma, gapCores);
      return { amplitudeWu: coreWu * bump.amplitude, centre: bump.centre, sigma, breadth: bump.sigma };
    });
}

/** `A · exp(−Δ² / 2σ²)` and its derivative in Δ. */
function lobeSample(lobe: RingLobe, delta: number): TracedRingSample {
  const value = lobe.amplitudeWu * Math.exp(-(delta * delta) / (SQUARE_DERIVATIVE_FACTOR * lobe.sigma * lobe.sigma));
  return { r: value, derivative: -value * (delta / (lobe.sigma * lobe.sigma)) };
}

/** `R(θ) = ring + the tallest stack`, with `R′`: each lobe plus every broader one; the circle where no lobe reaches. */
export function tracedRingAt(lobes: readonly RingLobe[], ringRadiusWu: number, theta: number): TracedRingSample {
  const samples = lobes.map((lobe) => lobeSample(lobe, wrapAngle(theta - lobe.centre)));
  let best: TracedRingSample = { r: 0, derivative: 0 };
  lobes.forEach((lobe, index) => {
    let height = 0;
    let derivative = 0;
    lobes.forEach((other, otherIndex) => {
      if (otherIndex !== index && other.breadth <= lobe.breadth) return;
      height += samples[otherIndex]?.r ?? 0;
      derivative += samples[otherIndex]?.derivative ?? 0;
    });
    if (height > best.r) best = { r: height, derivative };
  });
  return { r: ringRadiusWu + best.r, derivative: best.derivative };
}

/** `√(R² + R′²) − ring` at `phi`: how much faster than its circle the traced ring runs there, wu per radian. */
function extraElementWu(lobes: readonly RingLobe[], ringRadiusWu: number, phi: number): number {
  const sample = tracedRingAt(lobes, ringRadiusWu, phi);
  return Math.hypot(sample.r, sample.derivative) - ringRadiusWu;
}

/**
 * The traced ring's extra arc length from `θ = −π` to `theta` over its circle's, wu: `∫ (√(R² + R′²) − ring) dφ` by
 * trapezoids on a fixed grid of `RING_TRACE_ARC_SAMPLES` round the turn, the step `theta` falls in integrated under its
 * straight line so the length grows smoothly. It only jumps where `θ` itself wraps, as the circle's arc does.
 */
export function tracedRingExtraArcWu(lobes: readonly RingLobe[], ringRadiusWu: number, theta: number): number {
  if (lobes.length === 0) return 0;
  const step = RADIANS_PER_FULL_TURN / RING_TRACE_ARC_SAMPLES;
  let extraWu = 0;
  let start = extraElementWu(lobes, ringRadiusWu, -Math.PI);
  for (let index = 0; index < RING_TRACE_ARC_SAMPLES; index += 1) {
    const phi = -Math.PI + index * step;
    if (phi >= theta) break;
    const end = extraElementWu(lobes, ringRadiusWu, phi + step);
    const covered = Math.min(theta - phi, step);
    extraWu += start * covered + ((end - start) * covered * covered) / (step + step);
    start = end;
  }
  return extraWu;
}

/** How far this frame's ring lobes can reach past the circle, in radii: the tallest stack of full lobe heights. */
export function ringLobeReachRadii(terms: RadialProfileTerms): number {
  const outward = terms.bumps.filter((bump) => bump.amplitude > 0);
  const heights = outward.map((bump) => (coreRadiusWu(terms, bump.centre) * bump.amplitude) / terms.radius);
  let reach = 0;
  outward.forEach((bump, index) => {
    let stack = 0;
    outward.forEach((other, otherIndex) => {
      if (otherIndex === index || other.sigma > bump.sigma) stack += heights[otherIndex] ?? 0;
    });
    reach = Math.max(reach, stack);
  });
  return reach;
}

/**
 * The most a ring's lobes can reach past its circle over **any** frame in `state`, in radii: a full-length pseudopod
 * stacked on the clips' widest bump sum, on the widest core the pulse, the form and the stretch make.
 */
export function peakRingLobeRadii(traits: CellTraitSummary, state: CellDrawState): number {
  const lobeReach = pseudopodCount(traits.form, traits.formTier) > 0 ? PSEUDOPOD_REACH : 0;
  const bumpReach = lobeReach + state.clip.bumpRadii;
  if (bumpReach === 0) return 0;
  const formPeak = traits.form.profileAt(traits.formTier)?.peak ?? 1;
  return state.clip.pulse * formPeak * peakStretchRadii(state.speedRatio, state.isSprinting) * bumpReach;
}

/**
 * What a label keeps clear of: a cell swimming flat out or sprinting, playing no clip. Its arms, not an engulf's, which
 * last a moment; a round cell's rings are then exactly their circles, so its labels sit where they always did.
 */
const LABEL_RING_STATE: CellDrawState = {
  speedRatio: 1,
  isSprinting: true,
  clip: REST_CLIP_PEAK,
  effectRadii: NO_EFFECT_REACH,
};

/** How far past its circle a ring on `view` can trace its arms, px on a cell of `screenRadiusPx`: 0 on a round cell. */
export function ringArmReachPx(view: CellView, screenRadiusPx: number): number {
  return peakRingLobeRadii(summariseCellTraits(view, null), LABEL_RING_STATE) * screenRadiusPx;
}
