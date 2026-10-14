// @vitest-environment node
// Flat point lists and boxes (docs/rendering/opening-dive.md §4).

import { describe, expect, it } from 'vitest';
import { isOutside, pointCount, pointX, pointY, segmentBox, unionBox } from './shore-points';

describe('flat points', () => {
  it('reads x and y pairs and counts them', () => {
    const points = [1, 2, 3, 4, 5, 6];
    expect(pointCount(points)).toBe(3);
    expect([pointX(points, 2), pointY(points, 2)]).toEqual([5, 6]);
    expect(pointX(points, 9)).toBe(0);
  });
});

describe('boxes', () => {
  const window = { minX: -10, minY: -5, maxX: 10, maxY: 5 };

  it('finds a segment outside a window only past the margin', () => {
    const box = segmentBox([12, 0], [14, 1]);
    expect(isOutside(box, window, 0)).toBe(true);
    expect(isOutside(box, window, 3)).toBe(false);
    expect(isOutside(segmentBox([0, -9], [0, -7]), window, 1)).toBe(true);
  });

  it('joins two boxes', () => {
    expect(unionBox(segmentBox([0, 0], [1, 1]), segmentBox([-2, 3], [-1, 4]))).toEqual({
      minX: -2,
      minY: 0,
      maxX: 1,
      maxY: 4,
    });
  });
});
