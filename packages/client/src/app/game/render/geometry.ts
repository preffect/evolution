// Small pure helpers every render module shares: angles, interpolation, easing-free ramps.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';

const DEGREES_PER_TURN = 360;
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

export function lerp(fromValue: number, toValue: number, mix: number): number {
  return fromValue + (toValue - fromValue) * mix;
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

export function hypot(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

/** A Gaussian bump `amplitude · exp(−Δ² / (2 σ²))` and its derivative in Δ. */
export function gaussianBump(amplitude: number, delta: number, sigma: number): { value: number; derivative: number } {
  const value = amplitude * Math.exp(-(delta * delta) / (SQUARE_DERIVATIVE_FACTOR * sigma * sigma));
  return { value, derivative: -value * (delta / (sigma * sigma)) };
}
