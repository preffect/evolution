import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { TICK_INTERVAL_S } from '../constants/network.js';
import { DEFAULT_CELL_MODIFIERS } from '../constants/traits.js';
import { gelSpeedFactor } from './mass-curves.js';
import {
  gelZoneSpeedFactor,
  movementStepFor,
  speedCapFor,
  sprintSpeedFactorFor,
  type MovementCellState,
} from './movement-step.js';

const { controls, growth } = DEFAULT_BALANCE;
const GROWN_MASS = 320;

function cellState(overrides: Partial<MovementCellState> = {}): MovementCellState {
  return {
    mass: growth.CELL_STARTING_MASS,
    radiusWu: 18,
    sprintRemainingTicks: 0,
    modifiers: DEFAULT_CELL_MODIFIERS,
    isInGel: false,
    engulfFactor: 1,
    ...overrides,
  };
}

describe('sprintSpeedFactorFor', () => {
  it('is the multiplier plus the bonus while a sprint runs, and 1 once it has run out', () => {
    expect(sprintSpeedFactorFor(1, 0.3, controls)).toBeCloseTo(controls.SPRINT_SPEED_MULTIPLIER + 0.3, 9);
    expect(sprintSpeedFactorFor(0, 0.3, controls)).toBe(1);
  });
});

describe('gelZoneSpeedFactor', () => {
  it('applies the gel curve, with the floor, only inside a patch', () => {
    const inGel = cellState({ mass: GROWN_MASS, isInGel: true });
    expect(gelZoneSpeedFactor(inGel, DEFAULT_BALANCE)).toBe(gelSpeedFactor(GROWN_MASS, growth, 0));
    expect(gelZoneSpeedFactor({ ...inGel, isInGel: false }, DEFAULT_BALANCE)).toBe(1);
    const floored = { ...inGel, modifiers: { ...DEFAULT_CELL_MODIFIERS, gelSpeedFactorFloor: 0.95 } };
    expect(gelZoneSpeedFactor(floored, DEFAULT_BALANCE)).toBe(0.95);
  });
});

describe('speedCapFor', () => {
  // #677: top speed does not depend on mass, so the smallest and the largest plain cell share one cap.
  it.each([growth.CELL_STARTING_MASS, GROWN_MASS, growth.CELL_MAX_MASS])(
    'is the base speed alone for a plain cell of mass %d',
    (mass) => {
      expect(speedCapFor(cellState({ mass }), DEFAULT_BALANCE)).toBe(growth.CELL_BASE_SPEED);
    },
  );

  it('multiplies every factor in, each of which alone moves the cap', () => {
    const modifiers = { ...DEFAULT_CELL_MODIFIERS, speedMultiplier: 1.1, sprintSpeedMultiplierBonus: 0.2 };
    const state = cellState({ mass: GROWN_MASS, sprintRemainingTicks: 3, modifiers, isInGel: true, engulfFactor: 0.5 });
    const expected =
      growth.CELL_BASE_SPEED *
      (controls.SPRINT_SPEED_MULTIPLIER + 0.2) *
      gelSpeedFactor(GROWN_MASS, growth, 0) *
      1.1 *
      0.5;
    expect(speedCapFor(state, DEFAULT_BALANCE)).toBeCloseTo(expected, 9);
    expect(speedCapFor({ ...state, engulfFactor: 1 }, DEFAULT_BALANCE)).toBeCloseTo(expected * 2, 9);
  });
});

describe('movementStepFor', () => {
  it('derives the blend from the acceleration and its multiplier, and carries the target and the dish', () => {
    const modifiers = { ...DEFAULT_CELL_MODIFIERS, accelerationSecondsMultiplier: 2 };
    const step = movementStepFor(cellState({ modifiers }), { x: 5, y: -7 }, DEFAULT_BALANCE);
    expect(step.blendPerTick).toBeCloseTo(TICK_INTERVAL_S / (growth.CELL_ACCELERATION_SECONDS * 2), 12);
    expect(step).toMatchObject({ targetX: 5, targetY: -7, radiusWu: 18, tickIntervalS: TICK_INTERVAL_S });
    expect(step.dishRadiusWu).toBe(DEFAULT_BALANCE.world.DISH_RADIUS);
    expect(step.speedCapWuPerSecond).toBe(growth.CELL_BASE_SPEED);
  });
});
