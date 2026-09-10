// The TypeScript reference of the cell profile `r(θ)`, its derivative and the perpendicular
// membrane distance (docs/RENDERING.md §2.1). The GLSL in cell-shader-patterns.ts evaluates the
// same expression; organelle mapping (§3) and the parity test read this one.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { SQUARE_DERIVATIVE_FACTOR, gaussianBump, hypot, wrapAngle } from '../geometry';
import { sampleNoiseStrip, type NoiseStrip } from '../noise/noise-strip';

export interface ShapeBump {
  /** Fraction of `r`. */
  readonly amplitude: number;
  /** Radians, cell frame. */
  readonly centre: number;
  /** Radians. */
  readonly sigma: number;
}

export interface WobbleTerm {
  readonly amplitude: number;
  readonly mode: number;
  /** `2π f t + φ`, folded by the caller. */
  readonly phase: number;
}

export interface StretchTerm {
  /** `speedRatio` (0 at rest, 1 at max speed). */
  readonly k: number;
  readonly along: number;
  readonly taper: number;
  readonly acrossPerAlong: number;
  /** Extra axial scale along / across the heading (the eat clip's 1.07 × 0.95, the sprint's 1.06). */
  readonly axialAlong: number;
  readonly axialAcross: number;
}

export interface StripTerm {
  readonly strip: NoiseStrip;
  readonly row: number;
  /** Turns. */
  readonly phase: number;
  readonly jitterAmplitude: number;
  readonly lobesScale: number;
}

/** `B(Δ)` and its derivative for a form (#121); the blob is `null`. */
export interface FormProfile {
  evaluate(delta: number): { value: number; derivative: number };
}

export interface RadialProfileTerms {
  readonly radius: number;
  readonly pulse: number;
  readonly heading: number;
  readonly breathing: number;
  readonly wobble: WobbleTerm;
  readonly strip: StripTerm | null;
  readonly stretch: StretchTerm;
  readonly bumps: readonly ShapeBump[];
  readonly form: FormProfile | null;
}

export interface ProfileSample {
  /** World units. */
  readonly r: number;
  /** `dr/dθ`, world units per radian. */
  readonly derivative: number;
}

function stretchAt(term: StretchTerm, delta: number): { value: number; derivative: number } {
  const cos = Math.cos(delta);
  const sin = Math.sin(delta);
  const forward = Math.max(cos, 0);
  const rear = Math.max(-cos, 0);
  const alongGain = term.along - 1;
  const taperLoss = 1 - term.taper;
  const speed =
    1 +
    term.k * (alongGain * forward * forward - taperLoss * rear * rear - alongGain * term.acrossPerAlong * sin * sin);
  const speedDerivative =
    term.k *
    SQUARE_DERIVATIVE_FACTOR *
    (-alongGain * forward * sin - taperLoss * rear * sin - alongGain * term.acrossPerAlong * sin * cos);
  const axial = 1 + (term.axialAlong - 1) * cos * cos + (term.axialAcross - 1) * sin * sin;
  const axialDerivative = (term.axialAcross - term.axialAlong) * SQUARE_DERIVATIVE_FACTOR * sin * cos;
  return { value: speed * axial, derivative: speedDerivative * axial + speed * axialDerivative };
}

function stripAt(term: StripTerm | null, theta: number): { value: number; derivative: number } {
  if (term === null) return { value: 0, derivative: 0 };
  const sample = sampleNoiseStrip(term.strip, term.row, theta / RADIANS_PER_FULL_TURN + term.phase);
  return {
    value: term.jitterAmplitude * sample.jitter + term.lobesScale * sample.lobes,
    derivative: term.jitterAmplitude * sample.jitterDerivative + term.lobesScale * sample.lobesDerivative,
  };
}

/** `1 + breathing + wobble + jitter + lobes + Σ bumps` and its derivative in θ. */
export function surfaceTerms(terms: RadialProfileTerms, theta: number): { value: number; derivative: number } {
  const wobbleArgument = terms.wobble.mode * theta + terms.wobble.phase;
  let value = 1 + terms.breathing + terms.wobble.amplitude * Math.sin(wobbleArgument);
  let derivative = terms.wobble.amplitude * terms.wobble.mode * Math.cos(wobbleArgument);
  const strip = stripAt(terms.strip, theta);
  value += strip.value;
  derivative += strip.derivative;
  for (const bump of terms.bumps) {
    const sample = gaussianBump(bump.amplitude, wrapAngle(theta - bump.centre), bump.sigma);
    value += sample.value;
    derivative += sample.derivative;
  }
  return { value, derivative };
}

/** `r(θ) = r · pulse · B(θ − h) · stretch(θ − h) · (1 + …)` with `r′(θ)`. */
export function evaluateProfile(terms: RadialProfileTerms, theta: number): ProfileSample {
  const delta = wrapAngle(theta - terms.heading);
  const stretch = stretchAt(terms.stretch, delta);
  const form = terms.form?.evaluate(delta) ?? { value: 1, derivative: 0 };
  const surface = surfaceTerms(terms, theta);
  const scale = terms.radius * terms.pulse;
  const shape = form.value * stretch.value;
  const shapeDerivative = form.derivative * stretch.value + form.value * stretch.derivative;
  return {
    r: scale * shape * surface.value,
    derivative: scale * (shapeDerivative * surface.value + shape * surface.derivative),
  };
}

/** `d(p) = (|p| − r(θ)) / sqrt(1 + (r′/r)²)`, world units, positive outside the membrane. */
export function perpendicularDistance(terms: RadialProfileTerms, x: number, y: number): number {
  const theta = Math.atan2(y, x);
  const sample = evaluateProfile(terms, theta);
  const slope = sample.derivative / sample.r;
  return (hypot(x, y) - sample.r) / Math.sqrt(1 + slope * slope);
}

/** `r(θ)` at `count` evenly spaced angles from 0, as radius fractions. */
export function sampleProfileRing(terms: RadialProfileTerms, count: number): number[] {
  return Array.from({ length: count }, (_unused, index) => {
    const theta = (index / count) * RADIANS_PER_FULL_TURN;
    return evaluateProfile(terms, theta).r / terms.radius;
  });
}
