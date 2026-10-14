// @vitest-environment node
// The slime's sprite ladders and atlases (docs/rendering/opening-dive.md §4, ticket #803): rungs √2 apart up to the
// first at or past the top, the smallest rung at least as big as an object picked (never magnified below the top), and
// pictures packed in shelves that never overlap, each with its gutter, inside an atlas a power of two tall.

import { describe, expect, it } from 'vitest';
import { SLIME_SPRITE_LADDER } from '../../constants/dive-slime';
import { ladderSizes, packAtlas, rungFor } from './slime-sprite-ladder';

describe('ladderSizes', () => {
  it('steps √2 from the least size up to the first rung at or past the top', () => {
    const sizes = ladderSizes(64);
    expect(sizes[0]).toBe(SLIME_SPRITE_LADDER.minPx);
    for (let rung = 1; rung < sizes.length; rung += 1)
      expect(sizes[rung]! / sizes[rung - 1]!).toBeCloseTo(Math.SQRT2, 9);
    expect(sizes.at(-1)!).toBeGreaterThanOrEqual(64);
    expect(sizes.at(-2)!).toBeLessThan(64);
  });
});

describe('rungFor', () => {
  it('picks the smallest rung at least as big, so a sprite shrinks by at most √2, and the top past the ladder', () => {
    const sizes = ladderSizes(64);
    expect(rungFor(sizes, 1)).toBe(0);
    expect(rungFor(sizes, sizes[3]!)).toBe(3);
    expect(rungFor(sizes, sizes[3]! + 0.01)).toBe(4);
    expect(rungFor(sizes, 1000)).toBe(sizes.length - 1);
  });
});

describe('packAtlas', () => {
  it('packs every picture into shelves, none overlapping, each a gutter clear of the next and of the edges', () => {
    const sizes: [number, number][] = [
      [900, 40],
      [900, 60],
      [500, 500],
      [30, 30],
      [2000, 10],
    ];
    const layout = packAtlas(sizes);
    const gutter = SLIME_SPRITE_LADDER.gutterPx;
    expect(layout.width).toBe(SLIME_SPRITE_LADDER.atlasWidthPx);
    expect(Math.log2(layout.height) % 1).toBe(0);
    layout.rects.forEach((rect, index) => {
      expect([rect.width, rect.height]).toEqual(sizes[index]);
      expect(rect.x).toBeGreaterThanOrEqual(gutter);
      expect(rect.y).toBeGreaterThanOrEqual(gutter);
      expect(rect.x + rect.width + gutter).toBeLessThanOrEqual(layout.width);
      expect(rect.y + rect.height + gutter).toBeLessThanOrEqual(layout.height);
      layout.rects.slice(index + 1).forEach((other) => {
        const isApart =
          rect.x + rect.width + gutter <= other.x ||
          other.x + other.width + gutter <= rect.x ||
          rect.y + rect.height + gutter <= other.y ||
          other.y + other.height + gutter <= rect.y;
        expect(isApart).toBe(true);
      });
    });
  });
});
