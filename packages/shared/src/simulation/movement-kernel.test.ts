// docs/ECOLOGY.md §5.2 and docs/GAME-DESIGN.md §6, §8 on the pure kernel (G4, G5, G6 are the same
// rules through the whole module).
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { TICK_INTERVAL_S } from '../constants/network.js';
import {
  clampToDish,
  steerBlendPerTick,
  steerCommand,
  steerThrottle,
  stepMovementKernel,
  type MovementPose,
  type MovementStep,
} from './movement-kernel.js';

const controls = DEFAULT_BALANCE.controls;
const RADIUS = 20;
const SPEED_CAP = 220;
const DISH_RADIUS = 3000;
const BLEND = steerBlendPerTick(DEFAULT_BALANCE.growth.CELL_ACCELERATION_SECONDS, TICK_INTERVAL_S);

function createStep(overrides: Partial<MovementStep> = {}): MovementStep {
  return {
    targetX: 1000,
    targetY: 0,
    radiusWu: RADIUS,
    speedCapWuPerSecond: SPEED_CAP,
    blendPerTick: BLEND,
    tickIntervalS: TICK_INTERVAL_S,
    dishRadiusWu: DISH_RADIUS,
    controls,
    ...overrides,
  };
}

const REST: MovementPose = { x: 0, y: 0, velocityX: 0, velocityY: 0 };

describe('steerThrottle', () => {
  it('is 0 inside the dead zone, 1 beyond full throttle and linear between', () => {
    expect(steerThrottle(RADIUS * 0.5, RADIUS, controls)).toBe(0);
    expect(steerThrottle(RADIUS * 0.2, RADIUS, controls)).toBe(0);
    expect(steerThrottle(RADIUS * 1.25, RADIUS, controls)).toBeCloseTo(0.5, 12);
    expect(steerThrottle(RADIUS * 2, RADIUS, controls)).toBe(1);
    expect(steerThrottle(RADIUS * 50, RADIUS, controls)).toBe(1);
  });
});

describe('steerCommand', () => {
  it('answers the unit direction toward the target and the throttle along it', () => {
    const command = steerCommand(REST, { targetX: RADIUS * 2, targetY: 0, radiusWu: RADIUS, controls });
    expect(command.directionX).toBeCloseTo(1, 12);
    expect(command.directionY).toBeCloseTo(0, 12);
    expect(command.throttle).toBe(1);
  });

  it('is the dead zone at a target on the centre: no direction and no throttle', () => {
    expect(steerCommand(REST, { targetX: 0, targetY: 0, radiusWu: RADIUS, controls })).toEqual({
      directionX: 0,
      directionY: 0,
      throttle: 0,
    });
  });

  it('is the same throttle `steerThrottle` gives, so the engulf struggle and the movement agree', () => {
    const target = { targetX: RADIUS * 1.25, targetY: 0, radiusWu: RADIUS, controls };
    expect(steerCommand(REST, target).throttle).toBe(steerThrottle(RADIUS * 1.25, RADIUS, controls));
  });
});

describe('steerBlendPerTick', () => {
  it('derives 1/15 from a quarter-second acceleration at 60 Hz', () => {
    expect(BLEND).toBeCloseTo(1 / 15, 12);
  });

  it('caps the blend at 1 when the acceleration is shorter than a tick', () => {
    expect(steerBlendPerTick(TICK_INTERVAL_S, TICK_INTERVAL_S)).toBe(1);
    expect(steerBlendPerTick(TICK_INTERVAL_S / 4, TICK_INTERVAL_S)).toBe(1);
  });
});

describe('stepMovementKernel', () => {
  it('reaches 216.5 wu/s after 60 ticks at full throttle (G4)', () => {
    let pose = REST;
    for (let tick = 0; tick < 60; tick += 1) {
      pose = stepMovementKernel(pose, createStep({ targetX: pose.x + 5 * RADIUS }));
    }
    expect(pose.velocityX).toBeCloseTo(SPEED_CAP * (1 - (1 - BLEND) ** 60), 6);
    expect(pose.velocityY).toBe(0);
  });

  it('does not move for a target inside the dead zone (G5)', () => {
    const pose = stepMovementKernel(REST, createStep({ targetX: RADIUS * 0.4 }));
    expect(pose).toEqual(REST);
  });

  it('coasts to a stop when the target is the centre itself', () => {
    const moving: MovementPose = { x: 0, y: 0, velocityX: 150, velocityY: 0 };
    const pose = stepMovementKernel(moving, createStep({ targetX: 0, targetY: 0 }));
    expect(pose.velocityX).toBeCloseTo(150 * (1 - BLEND), 12);
  });

  it('clamps the centre to the wall and zeroes the outward velocity (G6)', () => {
    let pose: MovementPose = { x: 2990, y: 0, velocityX: 0, velocityY: 0 };
    for (let tick = 0; tick < 120; tick += 1) {
      pose = stepMovementKernel(pose, createStep({ targetX: 4000 }));
    }
    expect(pose.x).toBe(DISH_RADIUS - RADIUS);
    expect(pose.velocityX).toBe(0);
  });
});

describe('clampToDish', () => {
  it('leaves an inside pose untouched', () => {
    const inside: MovementPose = { x: 100, y: 100, velocityX: 5, velocityY: 5 };
    expect(clampToDish(inside, RADIUS, DISH_RADIUS)).toBe(inside);
  });

  it('keeps the tangential velocity and removes only the outward radial component', () => {
    const clamped = clampToDish({ x: 0, y: 3100, velocityX: 30, velocityY: 40 }, RADIUS, DISH_RADIUS);
    expect(clamped.y).toBe(DISH_RADIUS - RADIUS);
    expect(clamped.velocityX).toBe(30);
    expect(clamped.velocityY).toBe(0);
  });

  it('keeps an inward velocity on a pose that is already past the wall', () => {
    const clamped = clampToDish({ x: 3100, y: 0, velocityX: -40, velocityY: 0 }, RADIUS, DISH_RADIUS);
    expect(clamped.velocityX).toBe(-40);
  });
});
