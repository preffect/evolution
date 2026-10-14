// Wide strokes and scatter near the coast (docs/rendering/opening-dive.md §4): a stroke is built only from the runs of
// the coast that can paint the view, thinned to a share of its width; an offset ring moves to the sea side; a scatter
// keeps the world-stable cells whose distance up the shore lies in its range.

import { describe, expect, it } from 'vitest';
import { testShorePaint } from '../../../../../testing/shore-paint-builder';
import { nearCoastCells } from './shore-near-cells';
import { offsetRings, strokeAlongCoast, strokeNearPath } from './shore-near-strokes';
import { coastPoints } from './shore-paint';
import { pointCount, pointX, pointY } from './shore-points';

describe('strokeNearPath', () => {
  it('starts a run only where the coast passes near the view', () => {
    const paint = testShorePaint(1.5);
    const far = [1e6, 1e6, 1e6 + 10, 1e6, 1e6 + 10, 1e6 + 10];
    strokeNearPath(paint, [far], { halfWidthM: 5 });
    expect(paint.context.count('moveTo')).toBe(0);
  });

  it('keeps a ring that lies wholly in view closed, as one run', () => {
    const paint = testShorePaint(1.5);
    const square = [-1, -1, 1, -1, 1, 1, -1, 1];
    strokeNearPath(paint, [square], { halfWidthM: 0.5 });
    expect(paint.context.count('moveTo')).toBe(1);
    expect(paint.context.count('closePath')).toBe(1);
  });

  it('thins a run to a share of the narrowest width, never past its last point', () => {
    const paint = testShorePaint(1.5);
    const line = Array.from({ length: 200 }, (_unused, index) => [index * 0.01, 0]).flat();
    strokeNearPath(paint, [line], { halfWidthM: 30, isClosed: false });
    const drawn = paint.context.argumentsOf('lineTo');
    expect(drawn.length).toBeLessThan(199);
    expect(drawn.at(-1)).toEqual([1.99, 0]);
  });

  it('strokes the path its width at the colour asked', () => {
    const paint = testShorePaint(2.5);
    strokeAlongCoast(paint, coastPoints(paint.coast.rings), { halfWidthM: 4, colour: '#123456' });
    expect(paint.context.argumentsOf('stroke').at(-1)).toEqual([8]);
    expect(paint.context.strokeStyle).toBe('#123456');
  });
});

describe('offsetRings', () => {
  it('moves the coast out to sea for a positive distance and inland for a negative one', () => {
    const paint = testShorePaint(2.5);
    const [seaward] = offsetRings(paint, 5, 3);
    const [inland] = offsetRings(paint, () => -5, 3);
    const ring = paint.coast.rings[0]!.points;
    let middle = 0;
    for (let index = 0; index < pointCount(ring); index += 1)
      if (Math.abs(pointX(ring, index)) < Math.abs(pointX(ring, middle))) middle = index;
    // the land lies north (−y): out to sea is +y
    expect(pointY(seaward!, middle)).toBeGreaterThan(pointY(ring, middle));
    expect(pointY(inland!, middle)).toBeLessThan(pointY(ring, middle));
  });
});

describe('nearCoastCells', () => {
  const scatter = { cellM: 7, fromM: 1.8, toM: 10, salt: 201, maxCells: 1500 };

  it('keeps world-stable cells whose distance up the shore lies in the range', () => {
    const paint = testShorePaint(2);
    const cells = nearCoastCells(paint, scatter);
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      expect(cell.distanceM).toBeGreaterThanOrEqual(scatter.fromM);
      expect(cell.distanceM).toBeLessThanOrEqual(scatter.toM);
    }
    expect(nearCoastCells(testShorePaint(2), scatter)).toEqual(cells);
  });

  it('gives up on a view with too many cells for its budget', () => {
    expect(nearCoastCells(testShorePaint(3.5), scatter)).toEqual([]);
  });
});
