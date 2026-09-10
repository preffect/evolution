import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { maxSpeedForMass, radiusForMass } from './mass-curves.js';

const growth = DEFAULT_BALANCE.growth;

describe('mass curves (ECOLOGY §5.1 table)', () => {
  it.each([
    [20, 17.9, 220.0],
    [80, 35.8, 155.6],
    [320, 71.6, 110.0],
    [1000, 126.5, 82.7],
    [2000, 178.9, 69.6],
    [5000, 282.8, 55.3],
  ])('mass %d gives radius %f wu and max speed %f wu/s', (mass, radius, speed) => {
    expect(radiusForMass(mass, growth)).toBeCloseTo(radius, 1);
    expect(maxSpeedForMass(mass, growth)).toBeCloseTo(speed, 1);
  });

  it('caps the speed at the base speed below the starting mass', () => {
    expect(maxSpeedForMass(5, growth)).toBe(growth.CELL_BASE_SPEED);
  });

  it('floors the speed at the minimum speed for enormous masses', () => {
    expect(maxSpeedForMass(1e9, growth)).toBe(growth.CELL_MIN_SPEED);
  });

  it('treats a non-positive mass as the base speed and a zero radius', () => {
    expect(maxSpeedForMass(0, growth)).toBe(growth.CELL_BASE_SPEED);
    expect(radiusForMass(-1, growth)).toBe(0);
  });
});
