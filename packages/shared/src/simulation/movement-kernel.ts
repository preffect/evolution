// The movement step (docs/ECOLOGY.md §5.2, docs/GAME-DESIGN.md §6, §8), shared by the server's
// movement system and the client's prediction (docs/ARCHITECTURE.md §5). Pure: one pose in, one
// pose out, every number passed in. The caller computes the speed cap (mass curve, sprint, zone,
// trait and engulf factors) and the blend; the kernel only steers, integrates and clamps.

import type { BalanceConfig } from '../constants/balance.js';
import { clamp } from '../types/common.js';

export interface MovementPose {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
}

export type SteerBalance = Pick<BalanceConfig['controls'], 'STEER_DEAD_ZONE_RADII' | 'STEER_FULL_THROTTLE_RADII'>;

export interface MovementStep {
  targetX: number;
  targetY: number;
  radiusWu: number;
  /** `maxSpeed(mass) × sprint × zone × trait × engulf` factors, computed by the caller (wu/s). */
  speedCapWuPerSecond: number;
  /** `steerBlendPerTick(...)`: the share of the velocity gap closed this tick. */
  blendPerTick: number;
  tickIntervalS: number;
  dishRadiusWu: number;
  controls: SteerBalance;
}

/**
 * Throttle ramps from 0 when the target is within `STEER_DEAD_ZONE_RADII` radii of the centre to
 * 1 at `STEER_FULL_THROTTLE_RADII` radii.
 */
export function steerThrottle(distanceWu: number, radiusWu: number, controls: SteerBalance): number {
  const radii = distanceWu / radiusWu;
  const span = controls.STEER_FULL_THROTTLE_RADII - controls.STEER_DEAD_ZONE_RADII;
  return clamp((radii - controls.STEER_DEAD_ZONE_RADII) / span, 0, 1);
}

/** A blend of 1 closes the whole velocity gap in one tick; above it the velocity would overshoot and oscillate. */
const FULL_BLEND = 1;

/**
 * The per-tick steer blend, derived (never declared): `TICK_INTERVAL_S / (CELL_ACCELERATION_SECONDS × multiplier)`,
 * capped at 1 for an acceleration shorter than a tick (a small multiplier or a `debug_set_balance`).
 */
export function steerBlendPerTick(accelerationSeconds: number, tickIntervalS: number): number {
  return Math.min(FULL_BLEND, tickIntervalS / accelerationSeconds);
}

/**
 * Keeps the centre inside `dishRadiusWu − radiusWu`; on contact the outward radial velocity
 * component is zeroed (no bounce), the tangential one is kept.
 */
export function clampToDish(pose: MovementPose, radiusWu: number, dishRadiusWu: number): MovementPose {
  const reach = dishRadiusWu - radiusWu;
  const distance = Math.hypot(pose.x, pose.y);
  if (distance <= reach) {
    return pose;
  }
  const radialX = pose.x / distance;
  const radialY = pose.y / distance;
  const outwardSpeed = pose.velocityX * radialX + pose.velocityY * radialY;
  const removed = Math.max(0, outwardSpeed);
  return {
    x: radialX * reach,
    y: radialY * reach,
    velocityX: pose.velocityX - removed * radialX,
    velocityY: pose.velocityY - removed * radialY,
  };
}

/** One tick of steering: throttle toward the target, blend the velocity, integrate, clamp to the dish. */
export function stepMovementKernel(pose: MovementPose, step: MovementStep): MovementPose {
  const deltaX = step.targetX - pose.x;
  const deltaY = step.targetY - pose.y;
  const distance = Math.hypot(deltaX, deltaY);
  const throttle = distance === 0 ? 0 : steerThrottle(distance, step.radiusWu, step.controls);
  const desiredSpeed = throttle * step.speedCapWuPerSecond;
  const desiredX = distance === 0 ? 0 : (deltaX / distance) * desiredSpeed;
  const desiredY = distance === 0 ? 0 : (deltaY / distance) * desiredSpeed;
  const velocityX = pose.velocityX + (desiredX - pose.velocityX) * step.blendPerTick;
  const velocityY = pose.velocityY + (desiredY - pose.velocityY) * step.blendPerTick;
  const moved = {
    x: pose.x + velocityX * step.tickIntervalS,
    y: pose.y + velocityY * step.tickIntervalS,
    velocityX,
    velocityY,
  };
  return clampToDish(moved, step.radiusWu, step.dishRadiusWu);
}
