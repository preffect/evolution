// The rings trace the body and its lobes (docs/visual-style/motion-and-legibility.md §5.1 rule 4, docs/rendering/cells.md
// §2.2, #730): the engulf-warning ring and the relation rings are their circle, or the body offset by the ring's gap
// along its normal wherever that passes the circle (a slipper's nose, a fast swimmer's front), plus a **ring lobe** over every
// bump that pushes the membrane out (the amoeba's arms, an engulf's arms, an eat's wrap), so each keeps its gap from
// the outline instead of cutting across it. A ring lobe is the bump at its full height in world units, its σ widened so
// the ring clears the arm's flanks by the gap as well as its tip. Each lobe rides on the sum of every broader lobe, and
// the ring takes the tallest of those stacks: an arm on an engulf's broad seal swell stacks as the membrane does, while
// two arms of one width side by side leave a notch between them, as an offset curve would. A round cell at rest has no
// lobe and a body scale of exactly 1 and flat, so its ring is its circle, bit for bit. The threat ring's dash is measured along
// the traced curve: its circle's arc plus the extra length, counted from the heading. The TypeScript reference of
// `cell-shader-rings.ts`, term for term; `traced-ring-reach.ts` bounds it for the quad, the cull and the labels.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { RING_TRACE_ARC_SAMPLES, RING_TRACE_BODY_ARC_SAMPLES, RING_TRACE_SIGMA_WIDENING } from '../constants';
import { HALF, SQUARE_DERIVATIVE_FACTOR, wrapAngle } from '../geometry';
import { stretchAt, type RadialProfileTerms } from './radial-profile';

/** One lobe of a traced ring: its height past the circle in world units, its centre and its widened σ (radians). */
export interface RingLobe {
  readonly amplitudeWu: number;
  readonly centre: number;
  readonly sigma: number;
  /** The membrane bump's own σ: a lobe stacks on every lobe whose breadth is greater. */
  readonly breadth: number;
}

/** A value and its derivative in θ: the traced ring's `R(θ)` and `R′(θ)` in world units, or the body's scale. */
export interface TracedRingSample {
  readonly r: number;
  readonly derivative: number;
}

/** The body terms a ring reads: its size, heading, form, stretch and pulse. */
export type RingBody = Pick<RadialProfileTerms, 'radius' | 'heading' | 'form' | 'stretch' | 'pulse'>;

/** One traced ring: its circle, the body it keeps its gap from (`null` for a bare circle) and its lobes. */
export interface TracedRing {
  readonly circleWu: number;
  readonly body: RingBody | null;
  readonly lobes: readonly RingLobe[];
}

/** `pulse · B · stretch` at `theta` and its derivative: the body's radius over `r` there; 1 for a bare circle. */
export function ringBodyScaleAt(body: RingBody | null, theta: number): TracedRingSample {
  if (body === null) return BARE_BODY;
  const delta = wrapAngle(theta - body.heading);
  const form = body.form === null ? BARE_FORM : body.form.evaluate(delta);
  const stretch = stretchAt(body.stretch, delta);
  return {
    r: body.pulse * form.value * stretch.value,
    derivative: body.pulse * (form.derivative * stretch.value + form.value * stretch.derivative),
  };
}

const BARE_BODY: TracedRingSample = { r: 1, derivative: 0 };
const BARE_FORM = { value: 1, derivative: 0 } as const;

/**
 * What the lobes stand on, with its slope: the circle, or the body offset by the ring's gap along its normal,
 * `r · S + gap · √(1 + (S′/S)²)`, wherever that passes it (a slipper's nose, a fast swimmer's front). A round cell at
 * rest (`S` exactly 1 and flat) keeps the exact circle. The slope is the body's, `r · S′`: the offset term's own slope
 * is second order and left out.
 */
export function ringBaseAt(ring: TracedRing, theta: number): TracedRingSample {
  const { body } = ring;
  const circle = { r: ring.circleWu, derivative: 0 };
  const scale = ringBodyScaleAt(body, theta);
  if (body === null || (scale.r <= 1 && scale.derivative === 0)) return circle;
  const slope = scale.derivative / scale.r;
  const offsetWu = body.radius * scale.r + (ring.circleWu - body.radius) * Math.sqrt(1 + slope * slope);
  return offsetWu <= ring.circleWu ? circle : { r: offsetWu, derivative: body.radius * scale.derivative };
}

/** The membrane's core radius under `centre`, wu: `r · pulse · B · stretch` there, before the surface terms. */
export function coreRadiusWu(terms: RadialProfileTerms, centre: number): number {
  const delta = wrapAngle(centre - terms.heading);
  const form = terms.form === null ? 1 : terms.form.evaluate(delta).value;
  return terms.radius * terms.pulse * form * stretchAt(terms.stretch, delta).value;
}

/** A lobe's σ widened for a ring `gapCores` core radii out: `√(σ² + RING_TRACE_SIGMA_WIDENING · ln(1 + g))`. */
export function widenedRingSigma(sigma: number, gapCores: number): number {
  return Math.sqrt(sigma * sigma + RING_TRACE_SIGMA_WIDENING * Math.log(1 + Math.max(gapCores, 0)));
}

/** The ring lobes round a circle of `circleWu` and the body: one per outward bump, its gap from what it stands on. */
export function ringLobesOf(terms: RadialProfileTerms, circleWu: number): RingLobe[] {
  const base: TracedRing = { circleWu, body: terms, lobes: [] };
  return terms.bumps
    .filter((bump) => bump.amplitude > 0)
    .map((bump) => {
      const coreWu = coreRadiusWu(terms, bump.centre);
      const gapCores = (ringBaseAt(base, bump.centre).r - coreWu) / coreWu;
      const sigma = widenedRingSigma(bump.sigma, gapCores);
      return { amplitudeWu: coreWu * bump.amplitude, centre: bump.centre, sigma, breadth: bump.sigma };
    });
}

/** The ring of `circleWu` traced round the body and the lobes these terms draw. */
export function tracedRingOf(terms: RadialProfileTerms, circleWu: number): TracedRing {
  return { circleWu, body: terms, lobes: ringLobesOf(terms, circleWu) };
}

/** `A · exp(−Δ² / 2σ²)` and its derivative in Δ. */
function lobeSample(lobe: RingLobe, delta: number): TracedRingSample {
  const value = lobe.amplitudeWu * Math.exp(-(delta * delta) / (SQUARE_DERIVATIVE_FACTOR * lobe.sigma * lobe.sigma));
  return { r: value, derivative: -value * (delta / (lobe.sigma * lobe.sigma)) };
}

/** The tallest stack of lobes at `theta`, each lobe with every broader one under it, and its derivative. */
function tallestStack(lobes: readonly RingLobe[], theta: number): TracedRingSample {
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
  return best;
}

/** `R(θ) = base + the tallest stack`, with `R′`: the circle exactly where neither the body nor a lobe reaches. */
export function tracedRingAt(ring: TracedRing, theta: number): TracedRingSample {
  const base = ringBaseAt(ring, theta);
  const stack = tallestStack(ring.lobes, theta);
  return { r: base.r + stack.r, derivative: base.derivative + stack.derivative };
}

/** `√(R² + R′²) − circle` at `phi`: how much faster than its circle the ring runs there; exactly 0 on the circle. */
function extraElementWu(ring: TracedRing, phi: number): number {
  const sample = tracedRingAt(ring, phi);
  if (sample.derivative === 0) return sample.r - ring.circleWu;
  return Math.hypot(sample.r, sample.derivative) - ring.circleWu;
}

/**
 * The traced ring's extra arc length over its circle's from the **heading** to `theta` (negative behind it), wu:
 * `∫ (√(R² + R′²) − circle) dφ` by trapezoids on a fixed grid round the turn (`RING_TRACE_ARC_SAMPLES`, or the
 * coarser `RING_TRACE_BODY_ARC_SAMPLES` for a ring with no lobe, which only the smooth body shapes), the step
 * `theta` falls in integrated under its straight line so the length grows smoothly. Counted from the heading, an arm
 * that grows slides only the dashes between it and the tail, and the sum jumps only at the tail, where the two halves
 * meet. 0 on a bare circle.
 */
export function tracedRingExtraArcWu(ring: TracedRing, theta: number): number {
  const anchor = ring.body?.heading ?? 0;
  const delta = wrapAngle(theta - anchor);
  const direction = delta < 0 ? -1 : 1;
  const span = Math.abs(delta);
  const samples = ring.lobes.length > 0 ? RING_TRACE_ARC_SAMPLES : RING_TRACE_BODY_ARC_SAMPLES;
  const step = RADIANS_PER_FULL_TURN / samples;
  let extraWu = 0;
  let start = extraElementWu(ring, anchor);
  for (let index = 0; index < samples * HALF; index += 1) {
    const reached = index * step;
    if (reached >= span) break;
    const end = extraElementWu(ring, anchor + direction * (reached + step));
    const covered = Math.min(span - reached, step);
    extraWu += start * covered + ((end - start) * covered * covered) / (step + step);
    start = end;
  }
  return direction * extraWu;
}
