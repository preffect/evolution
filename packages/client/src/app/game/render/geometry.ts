// Small pure helpers every render module shares: angles, ramps, and the unit factors (`HALF`, the
// degrees of a turn) so no render module declares its own copy (docs/CODE-STANDARDS.md §2).

import { RADIANS_PER_FULL_TURN, clamp } from '@evolution/shared';

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

/** An upright box by its centre and half-extents, in any one unit. */
export interface UprightBox {
  readonly x: number;
  readonly y: number;
  readonly halfWidth: number;
  readonly halfHeight: number;
}

/** A disc by its centre and radius, in the box's unit. */
export interface Disc {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/** Whether an upright box reaches inside a disc: its nearest point to the disc's centre lies within the radius. */
export function boxIntersectsDisc(box: UprightBox, disc: Disc): boolean {
  const nearestX = clamp(disc.x, box.x - box.halfWidth, box.x + box.halfWidth);
  const nearestY = clamp(disc.y, box.y - box.halfHeight, box.y + box.halfHeight);
  return Math.hypot(nearestX - disc.x, nearestY - disc.y) < disc.radius;
}

/** Whether two upright boxes overlap; boxes that only touch along an edge do not. */
export function boxesIntersect(first: UprightBox, second: UprightBox): boolean {
  return (
    Math.abs(first.x - second.x) < first.halfWidth + second.halfWidth &&
    Math.abs(first.y - second.y) < first.halfHeight + second.halfHeight
  );
}

/** A Gaussian bump `amplitude · exp(−Δ² / (2 σ²))` and its derivative in Δ. */
export function gaussianBump(amplitude: number, delta: number, sigma: number): { value: number; derivative: number } {
  const value = amplitude * Math.exp(-(delta * delta) / (SQUARE_DERIVATIVE_FACTOR * sigma * sigma));
  return { value, derivative: -value * (delta / (sigma * sigma)) };
}
