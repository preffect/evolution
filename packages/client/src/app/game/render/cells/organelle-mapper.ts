// Slots through the deformation (docs/RENDERING.md §3): lag against the heading, then
// `p = c + |q′| · r(θ_q′) · û(q′)` with the same radial profile the shader draws, so cytoplasm
// flows into a bump in proportion to ρ and stretches with the body.

import { NUCLEUS_LAG } from '../constants';
import { evaluateProfile, type RadialProfileTerms } from './radial-profile';

export interface MappedPoint {
  /** World offset from the cell centre (wu). */
  readonly x: number;
  readonly y: number;
  /** `r(θ)` at the slot's angle (wu), for a sprite that scales with the local membrane. */
  readonly localRadius: number;
}

export interface SlotMotion {
  /** `speedRatio`, 0 at rest. */
  readonly speedRatio: number;
  readonly heading: number;
  /** Extra rest drift in the cell frame (fractions of `r`), e.g. the nucleus's 2 % r. */
  readonly driftX: number;
  readonly driftY: number;
}

/** `q′ = q − LAG · k · ĥ` plus the slot's drift. */
export function laggedSlot(x: number, y: number, motion: SlotMotion): { x: number; y: number } {
  const lag = NUCLEUS_LAG * motion.speedRatio;
  return {
    x: x - lag * Math.cos(motion.heading) + motion.driftX,
    y: y - lag * Math.sin(motion.heading) + motion.driftY,
  };
}

/** The slot at `(x, y)` (cell frame, fractions of `r`) mapped through the profile `terms`: `|q| · r(θ_q) · û`. */
export function mapSlot(x: number, y: number, terms: RadialProfileTerms): MappedPoint {
  const localRadius = evaluateProfile(terms, Math.atan2(y, x)).r;
  return { x: x * localRadius, y: y * localRadius, localRadius };
}
