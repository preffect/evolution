import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { secondsToTicks } from '../time/units.js';
import { massAfterSprint, sprintCooldownTicksFor, sprintDurationTicks, sprintMassCost } from './sprint-cost.js';

const { controls, growth } = DEFAULT_BALANCE;
const GROWN_MASS = 320;

describe('sprintMassCost', () => {
  it('takes the fraction of a grown cell', () => {
    expect(sprintMassCost(GROWN_MASS, DEFAULT_BALANCE)).toBeCloseTo(GROWN_MASS * controls.SPRINT_MASS_COST_FRACTION, 9);
    expect(massAfterSprint(GROWN_MASS, DEFAULT_BALANCE)).toBe(GROWN_MASS * (1 - controls.SPRINT_MASS_COST_FRACTION));
  });

  it('clips at the starting mass, so a cell just above the floor pays only its surplus', () => {
    const surplus = 0.3;
    const mass = growth.CELL_STARTING_MASS + surplus;
    expect(sprintMassCost(mass, DEFAULT_BALANCE)).toBeCloseTo(surplus, 9);
    expect(massAfterSprint(mass, DEFAULT_BALANCE)).toBe(growth.CELL_STARTING_MASS);
  });

  it('costs nothing at the floor', () => {
    expect(sprintMassCost(growth.CELL_STARTING_MASS, DEFAULT_BALANCE)).toBe(0);
  });
});

describe('sprint timing', () => {
  it('runs for the duration in ticks', () => {
    expect(sprintDurationTicks(DEFAULT_BALANCE)).toBe(secondsToTicks(controls.SPRINT_DURATION_SECONDS));
  });

  it('cools down for the cooldown plus the delta, floored', () => {
    expect(sprintCooldownTicksFor(0, DEFAULT_BALANCE)).toBe(secondsToTicks(controls.SPRINT_COOLDOWN_SECONDS));
    expect(sprintCooldownTicksFor(-0.5, DEFAULT_BALANCE)).toBe(secondsToTicks(controls.SPRINT_COOLDOWN_SECONDS - 0.5));
    expect(sprintCooldownTicksFor(-1000, DEFAULT_BALANCE)).toBe(
      secondsToTicks(DEFAULT_BALANCE.traits.SPRINT_COOLDOWN_FLOOR_SECONDS),
    );
  });
});
