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

/** This tick's steer command: the unit direction toward the target and the throttle along it. */
export interface SteerCommand {
  readonly directionX: number;
  readonly directionY: number;
  /** 0..1; 0 also means "no direction", and then both components are 0. */
  readonly throttle: number;
}

/** What `steerCommand` reads of a step: where the cell is steering and how wide its dead zone is. */
export type SteerCommandStep = Pick<MovementStep, 'targetX' | 'targetY' | 'radiusWu' | 'controls'>;

/** No target to steer to: what a cell in its dead zone commands, and what a fresh cell starts with. */
export const NO_STEER_COMMAND: SteerCommand = { directionX: 0, directionY: 0, throttle: 0 };

/**
 * The direction and throttle this tick's movement uses. The engulf step's struggle
 * (docs/ECOLOGY.md §6.1) reads the prey's command through this, so the throttle arithmetic has one
 * home and "steering away slows the wrap" can never drift from "steering away moves the cell".
 */
export function steerCommand(pose: Pick<MovementPose, 'x' | 'y'>, step: SteerCommandStep): SteerCommand {
  const deltaX = step.targetX - pose.x;
  const deltaY = step.targetY - pose.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance === 0) {
    return NO_STEER_COMMAND;
  }
  return {
    directionX: deltaX / distance,
    directionY: deltaY / distance,
    throttle: steerThrottle(distance, step.radiusWu, step.controls),
  };
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

/**
 * One tick of steering from a command already taken: the caller that needs the command for something
 * else (the engulf struggle, docs/ECOLOGY.md §6.1) takes it once and passes it here, so the movement
 * and that other reader can never be looking at two different commands.
 */
export function stepMovementFrom(pose: MovementPose, command: SteerCommand, step: MovementStep): MovementPose {
  const desiredSpeed = command.throttle * step.speedCapWuPerSecond;
  const desiredX = command.directionX * desiredSpeed;
  const desiredY = command.directionY * desiredSpeed;
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

/** One tick of steering: throttle toward the target, blend the velocity, integrate, clamp to the dish. */
export function stepMovementKernel(pose: MovementPose, step: MovementStep): MovementPose {
  return stepMovementFrom(pose, steerCommand(pose, step), step);
}
