// docs/ecology/mass-and-movement.md §5.1: the radius table, pinned row by row, and the gel curve of §5.2.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { gelSpeedFactor, radiusForMass } from './mass-curves.js';

const growth = DEFAULT_BALANCE.growth;

describe('radiusForMass', () => {
  it.each([
    [20, 17.9],
    [80, 35.8],
    [320, 71.6],
    [1000, 126.5],
    [5000, 282.8],
  ])('mass %d → radius %f wu', (mass, radius) => {
    expect(radiusForMass(mass, growth)).toBeCloseTo(radius, 1);
  });
});

describe('gelSpeedFactor', () => {
  it('barely slows a starting cell and cuts a 600-mass cell to 40 %', () => {
    expect(gelSpeedFactor(20, growth, 0)).toBe(growth.GEL_MAX_SPEED_FACTOR);
    expect(gelSpeedFactor(600, growth, 0)).toBeCloseTo(0.4, 12);
    expect(gelSpeedFactor(2000, growth, 0)).toBe(growth.GEL_MIN_SPEED_FACTOR);
  });

  it('respects the amoeba floor', () => {
    expect(gelSpeedFactor(600, growth, 0.8)).toBe(0.8);
    expect(gelSpeedFactor(20, growth, 0.8)).toBe(growth.GEL_MAX_SPEED_FACTOR);
  });
});
