// Small pure helpers every render module shares: angles, ramps, and the unit factors (`HALF`, the
// degrees of a turn) so no render module declares its own copy (docs/CODE-STANDARDS.md §2).

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';

export const DEGREES_PER_TURN = 360;
export const HALF = 0.5;
/** A diameter (or a side) from a radius: the factor every bake sizes its canvas by. */
export const DIAMETER_PER_RADIUS = 2;
const HALF_TURN = Math.PI;
/** `d/dx x² = 2x`: the factor every closed-form derivative below carries. */
export const SQUARE_DERIVATIVE_FACTOR = 2;
/** Hermite `3u² − 2u³`, GLSL's smoothstep. */
const SMOOTHSTEP_CUBIC = 3;

export function degreesToRadians(degrees: number): number {
  return (degrees / DEGREES_PER_TURN) * RADIANS_PER_FULL_TURN;
}

/** Wraps an angle into (−π, π]. */
export function wrapAngle(radians: number): number {
  let wrapped = radians % RADIANS_PER_FULL_TURN;
  if (wrapped > HALF_TURN) wrapped -= RADIANS_PER_FULL_TURN;
  if (wrapped <= -HALF_TURN) wrapped += RADIANS_PER_FULL_TURN;
  return wrapped;
}

/** A position in turns (or any unit period) folded into [0, 1). */
export function wrapUnit(unit: number): number {
  return ((unit % 1) + 1) % 1;
}

/** The cosine ease `(1 − cos(πx)) / 2`: the smooth step of the periodic value noise. */
export function cosineSmoothstep(fraction: number): number {
  return (1 - Math.cos(Math.PI * fraction)) * HALF;
}

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** GLSL `smoothstep`, so TypeScript and the shader ramp the same way. */
export function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge1 === edge0) return value < edge0 ? 0 : 1;
  const unit = clamp01((value - edge0) / (edge1 - edge0));
  return unit * unit * (SMOOTHSTEP_CUBIC - SQUARE_DERIVATIVE_FACTOR * unit);
}

/** A Gaussian bump `amplitude · exp(−Δ² / (2 σ²))` and its derivative in Δ. */
export function gaussianBump(amplitude: number, delta: number, sigma: number): { value: number; derivative: number } {
  const value = amplitude * Math.exp(-(delta * delta) / (SQUARE_DERIVATIVE_FACTOR * sigma * sigma));
  return { value, derivative: -value * (delta / (sigma * sigma)) };
}
