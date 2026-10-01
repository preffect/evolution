// @vitest-environment node
// The exact Euclidean distance transform (docs/rendering/opening-dive.md §4): every cell's squared distance to the
// nearest 0 cell, checked against brute force.

import { describe, expect, it } from 'vitest';
import { FAR_SQUARED, squaredDistanceTransform } from './shore-distance';

describe('squaredDistanceTransform', () => {
  it('matches a brute-force search on a small grid with scattered features', () => {
    const width = 9;
    const height = 7;
    const features = [
      [1, 1],
      [7, 2],
      [3, 6],
    ];
    const grid = new Float64Array(width * height).fill(FAR_SQUARED);
    for (const [x, y] of features) grid[y! * width + x!] = 0;
    squaredDistanceTransform(grid, width, height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const brute = Math.min(...features.map(([featureX, featureY]) => (x - featureX!) ** 2 + (y - featureY!) ** 2));
        expect(grid[y * width + x]).toBe(brute);
      }
    }
  });

  it('leaves a grid with no feature far everywhere', () => {
    const grid = new Float64Array(12).fill(FAR_SQUARED);
    squaredDistanceTransform(grid, 4, 3);
    expect(Math.min(...grid)).toBeGreaterThanOrEqual(FAR_SQUARED);
  });
});
