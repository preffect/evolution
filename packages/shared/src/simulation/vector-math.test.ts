import { describe, expect, it } from 'vitest';
import { distanceBetween } from './vector-math.js';

describe('distanceBetween', () => {
  it('measures the euclidean distance in either direction', () => {
    expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(distanceBetween({ x: 3, y: 4 }, { x: 0, y: 0 })).toBe(5);
  });

  it('is zero from a point to itself', () => {
    expect(distanceBetween({ x: -2.5, y: 7 }, { x: -2.5, y: 7 })).toBe(0);
  });
});
