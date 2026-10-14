// @vitest-environment node
// The coastline bakes' signed distance (docs/rendering/opening-dive.md §4): the squared distance transform, the
// exact distance near the coast's segments, and the three-channel encoding the shader reads back.

import { describe, expect, it } from 'vitest';
import { LAND } from './land-raster';
import {
  bakeSignedDistance,
  decodeSignedDistance,
  distanceTransform1d,
  encodeSignedDistance,
  type CoastSegment,
} from './signed-distance';

function finished<T>(job: Generator<void, T>): T {
  for (let step = job.next(); ; step = job.next()) if (step.done === true) return step.value;
}

/** A `size × size` mask, land left of column `coastColumn`. */
function halfLand(size: number, coastColumn: number): Uint8Array {
  const mask = new Uint8Array(size * size);
  for (let row = 0; row < size; row += 1) mask.fill(LAND, row * size, row * size + coastColumn);
  return mask;
}

describe('distanceTransform1d', () => {
  it('gives each cell its squared distance to the nearest feature', () => {
    const far = 1e20;
    const rows = {
      input: Float64Array.from([far, 0, far, far, far, 0]),
      output: new Float64Array(6),
      parabolas: new Int32Array(6),
      boundaries: new Float64Array(7),
    };
    distanceTransform1d(rows, 6);
    expect([...rows.output]).toEqual([1, 0, 1, 4, 1, 0]);
  });
});

describe('encodeSignedDistance and decodeSignedDistance', () => {
  it('reads back the finest channel that has not saturated: quarter texels near, texels further, eights far', () => {
    const data = new Uint8Array(4);
    for (const [distance, step] of [
      [2.25, 0.25],
      [-30.5, 0.25],
      [100, 1],
      [-125, 1],
      [600, 8],
      [-1000, 8],
    ] as const) {
      encodeSignedDistance(data, 0, distance);
      expect(Math.abs(decodeSignedDistance(data, 0) - distance), String(distance)).toBeLessThanOrEqual(step / 2);
    }
  });
});

describe('bakeSignedDistance', () => {
  it('is positive on land, negative at sea, growing away from the coast', () => {
    const size = 32;
    const data = finished(bakeSignedDistance(halfLand(size, 16), size, size, []));
    const distanceAt = (column: number): number => decodeSignedDistance(data, 10 * size + column);
    expect(distanceAt(15)).toBeGreaterThan(0);
    expect(distanceAt(16)).toBeLessThan(0);
    expect(distanceAt(4)).toBeCloseTo(11.5, 6);
    expect(distanceAt(28)).toBeCloseTo(-12.5, 6);
  });

  it('takes the exact distance to a coast segment near it, so the zero line is the vector coast', () => {
    const size = 32;
    const coast: CoastSegment = { fromX: 16.3, fromY: 0, toX: 16.3, toY: size };
    const data = finished(bakeSignedDistance(halfLand(size, 16), size, size, [coast]));
    const distanceAt = (column: number): number => decodeSignedDistance(data, 10 * size + column);
    // Texel 15's centre is 0.8 texels west of the segment; texel 16's is 0.2 east of it, at sea.
    expect(distanceAt(15)).toBeCloseTo(0.75, 6);
    expect(distanceAt(16)).toBeCloseTo(-0.25, 6);
    expect(distanceAt(4)).toBeCloseTo(11.5, 6);
  });

  it('yields as it goes, so the dive bakes it in slices', () => {
    const size = 128;
    const job = bakeSignedDistance(halfLand(size, 64), size, size, []);
    let yields = 0;
    for (let step = job.next(); step.done !== true; step = job.next()) yields += 1;
    expect(yields).toBeGreaterThan(4);
  });
});
