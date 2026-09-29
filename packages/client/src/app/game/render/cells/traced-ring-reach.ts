// How far a traced ring reaches (#730, docs/rendering/cells.md §2 and §2.2): its circle scaled by the most its body
// pushes it out, plus its tallest stack of lobes. This frame's bound sizes the quad; the bound over any frame of a cell's
// traits sizes the cull; the labels keep past the arms and the body at rest (`traced-ring.ts` is the ring itself).

import { RADIANS_PER_FULL_TURN, type CellView } from '@evolution/shared';
import { PSEUDOPOD_REACH, RING_TRACE_REACH_MARGIN, RING_TRACE_REACH_SAMPLES } from '../constants';
import { NO_EFFECT_REACH, type CellDrawState } from './cell-draw-extent';
import { summariseCellTraits, type CellTraitSummary } from './cell-traits';
import { pseudopodCount } from './forms/form-profiles';
import type { RadialProfileTerms } from './radial-profile';
import { bodyStretchTerm, peakStretchRadii } from './body-stretch';
import { REST_CLIP_PEAK } from './shape-terms';
import { coreRadiusWu, ringBodyScaleAt, type RingBody } from './traced-ring';

/** How far this frame's ring lobes can reach past the scaled circle, in radii: the tallest stack of full lobe heights. */
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
 * The most the body pushes the ring's base past its circle, as a scale of it: `r · S + gap · √(1 + (S′/S)²)` is at most
 * `(r + gap) · max(S, √(1 + (S′/S)²))`, sampled round the turn with a margin for the peaks between samples; at least 1.
 */
export function ringBodyPeak(body: RingBody): number {
  let peak = 1;
  for (let index = 0; index < RING_TRACE_REACH_SAMPLES; index += 1) {
    const scale = ringBodyScaleAt(body, (index / RING_TRACE_REACH_SAMPLES) * RADIANS_PER_FULL_TURN);
    const slope = scale.derivative / scale.r;
    peak = Math.max(peak, scale.r, Math.sqrt(1 + slope * slope));
  }
  return peak === 1 ? 1 : peak * (1 + RING_TRACE_REACH_MARGIN);
}

function formPeakOf(traits: CellTraitSummary): number {
  return traits.form.profileAt(traits.formTier)?.peak ?? 1;
}

const bodyPeakCache = new Map<string, number>();

/** `ringBodyPeak` over **any** frame in `state`: the traits' form at the state's widest pulse, speed and sprint. */
export function peakRingBodyScale(traits: CellTraitSummary, state: CellDrawState): number {
  const key = `${traits.form.id}:${traits.formTier}:${state.clip.pulse}:${state.speedRatio}:${state.isSprinting}`;
  const cached = bodyPeakCache.get(key);
  if (cached !== undefined) return cached;
  const peak = ringBodyPeak({
    radius: 1,
    heading: 0,
    form: traits.form.profileAt(traits.formTier),
    stretch: bodyStretchTerm(traits.form, state.speedRatio, state.isSprinting),
    pulse: state.clip.pulse,
  });
  bodyPeakCache.set(key, peak);
  return peak;
}

/**
 * The most a ring's lobes can reach past its scaled circle over **any** frame in `state`, in radii: a full-length
 * pseudopod stacked on the clips' widest bump sum, on the widest core the pulse, the form and the stretch make.
 */
export function peakRingLobeRadii(traits: CellTraitSummary, state: CellDrawState): number {
  const lobeReach = pseudopodCount(traits.form, traits.formTier) > 0 ? PSEUDOPOD_REACH : 0;
  const bumpReach = lobeReach + state.clip.bumpRadii;
  if (bumpReach === 0) return 0;
  return (
    state.clip.pulse *
    formPeakOf(traits) *
    peakStretchRadii(traits.form, state.speedRatio, state.isSprinting) *
    bumpReach
  );
}

/**
 * What a label keeps clear of: the arms of a cell swimming flat out or sprinting, playing no clip (an engulf's last a
 * moment), round a body at rest. A round cell's ring is then exactly its circle, so its labels sit where they did.
 */
const LABEL_ARM_STATE: CellDrawState = {
  speedRatio: 1,
  isSprinting: true,
  clip: REST_CLIP_PEAK,
  effectRadii: NO_EFFECT_REACH,
};
const LABEL_BODY_STATE: CellDrawState = { ...LABEL_ARM_STATE, speedRatio: 0, isSprinting: false };

/** How far a ring of circle `circlePx` on `view` reaches, px: scaled round its body at rest, then past its arms. */
export function ringLabelReachPx(view: CellView, circlePx: number, screenRadiusPx: number): number {
  const traits = summariseCellTraits(view, null);
  const armsPx = peakRingLobeRadii(traits, LABEL_ARM_STATE) * screenRadiusPx;
  return circlePx * peakRingBodyScale(traits, LABEL_BODY_STATE) + armsPx;
}
