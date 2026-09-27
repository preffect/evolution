// @vitest-environment node
// The unit-area rule (docs/rendering/cells.md §2.4): the mean square radius of a silhouette and the scale that fixes it.

import { describe, expect, it } from 'vitest';
import { meanSquareRadius, unitAreaScale } from './unit-area';

describe('unit area', () => {
  it('reads 1 for the unit circle and the square of a scaled one', () => {
    expect(meanSquareRadius(() => 1)).toBe(1);
    expect(meanSquareRadius(() => 2)).toBe(4);
  });

  it('scales any silhouette to the unit disc’s area', () => {
    const egg = (delta: number): number => 1.4 + 0.3 * Math.cos(delta);
    const scale = unitAreaScale(egg);
    expect(meanSquareRadius((delta) => scale * egg(delta))).toBeCloseTo(1, 12);
  });
});
