// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { sparklinePointsFor } from './sparkline';

const WIDTH = 100;
const HEIGHT = 20;

/** `x,y` pairs back as numbers, so a spec asserts on geometry rather than on string punctuation. */
function pointsOf(attribute: string): { x: number; y: number }[] {
  return attribute.split(' ').map((pair) => {
    const [x = '0', y = '0'] = pair.split(',');
    return { x: Number(x), y: Number(y) };
  });
}

describe('sparklinePointsFor', () => {
  it('draws nothing for a history too short to be a line', () => {
    expect(sparklinePointsFor([], WIDTH, HEIGHT)).toBeNull();
    expect(sparklinePointsFor([312], WIDTH, HEIGHT)).toBeNull();
  });

  it('spreads the points evenly across the width, oldest at the left', () => {
    const points = pointsOf(sparklinePointsFor([10, 20, 30], WIDTH, HEIGHT)!);
    expect(points.map((point) => point.x)).toEqual([0, WIDTH / 2, WIDTH]);
  });

  it('inverts y, so a growing mass rises on screen', () => {
    const points = pointsOf(sparklinePointsFor([10, 30], WIDTH, HEIGHT)!);
    // The lowest mass sits on the bottom edge, the highest on the top one.
    expect(points[0]?.y).toBe(HEIGHT);
    expect(points[1]?.y).toBe(0);
  });

  it('scales to the run rather than to an absolute mass, so a small change still reads as movement', () => {
    // 310..314 is a 1 % change; against a 0..CELL_MAX_MASS box it would be a flat line near the top.
    const points = pointsOf(sparklinePointsFor([310, 314], WIDTH, HEIGHT)!);
    expect(points[0]?.y).toBe(HEIGHT);
    expect(points[1]?.y).toBe(0);
  });

  it('draws a flat life down the middle instead of dividing by a zero spread', () => {
    const points = pointsOf(sparklinePointsFor([312, 312, 312], WIDTH, HEIGHT)!);
    for (const point of points) expect(point.y).toBe(HEIGHT / 2);
  });

  it('keeps every point inside its box', () => {
    const points = pointsOf(sparklinePointsFor([20, 312, 96, 200], WIDTH, HEIGHT)!);
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(WIDTH);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(HEIGHT);
    }
  });
});
