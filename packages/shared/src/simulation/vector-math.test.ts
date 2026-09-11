import { describe, expect, it } from 'vitest';
import {
  distanceBetween,
  pointOnCircle,
  uniformPointInAnnulus,
  uniformPointInDiscAround,
  unitVectorToward,
} from './vector-math.js';

describe('vector-math', () => {
  it('measures the distance between two points', () => {
    expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('gives the unit direction, and the zero vector for coincident points', () => {
    expect(unitVectorToward({ x: 1, y: 1 }, { x: 4, y: 5 })).toEqual({ x: 0.6, y: 0.8 });
    expect(unitVectorToward({ x: 1, y: 1 }, { x: 1, y: 1 })).toEqual({ x: 0, y: 0 });
  });

  it('places a point on a circle by angle', () => {
    const point = pointOnCircle(2, Math.PI / 2);
    expect(point.x).toBeCloseTo(0, 12);
    expect(point.y).toBeCloseTo(2, 12);
  });

  it('maps the unit square into the annulus by area: the radial draw is a square-root mix', () => {
    expect(Math.hypot(...Object.values(uniformPointInAnnulus(0, 10, 0.25, 0)))).toBeCloseTo(5, 12);
    expect(Math.hypot(...Object.values(uniformPointInAnnulus(6, 10, 0, 0.5)))).toBeCloseTo(6, 12);
    expect(Math.hypot(...Object.values(uniformPointInAnnulus(6, 10, 1, 0.5)))).toBeCloseTo(10, 12);
  });

  it('offsets a disc draw from its centre', () => {
    const point = uniformPointInDiscAround({ x: 100, y: 50 }, 10, 1, 0);
    expect(point.x).toBeCloseTo(110, 12);
    expect(point.y).toBeCloseTo(50, 12);
  });
});
