import { describe, expect, it } from 'vitest';
import { LIGHT_DIRECTION_DEG, NUCLEUS_OFFSET_TOWARD_LIGHT } from './constants';
import { LIGHT_DIRECTION_RADIANS, LIGHT_UNIT_VECTOR, NUCLEUS_REST_OFFSET } from './light-direction';

describe('light direction', () => {
  it('is LIGHT_DIRECTION_DEG in radians with a unit vector toward it (upper left at −135°)', () => {
    expect(LIGHT_DIRECTION_RADIANS).toBeCloseTo((LIGHT_DIRECTION_DEG * Math.PI) / 180, 12);
    expect(Math.hypot(LIGHT_UNIT_VECTOR.x, LIGHT_UNIT_VECTOR.y)).toBeCloseTo(1, 12);
    expect(LIGHT_UNIT_VECTOR.x).toBeLessThan(0);
    expect(LIGHT_UNIT_VECTOR.y).toBeLessThan(0);
  });

  it('rests the nucleus NUCLEUS_OFFSET_TOWARD_LIGHT along the light', () => {
    expect(Math.hypot(NUCLEUS_REST_OFFSET.x, NUCLEUS_REST_OFFSET.y)).toBeCloseTo(NUCLEUS_OFFSET_TOWARD_LIGHT, 12);
    expect(NUCLEUS_REST_OFFSET.x / NUCLEUS_REST_OFFSET.y).toBeCloseTo(LIGHT_UNIT_VECTOR.x / LIGHT_UNIT_VECTOR.y, 12);
  });
});
