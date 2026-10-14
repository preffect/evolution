// @vitest-environment node
// The ribbons' mesh (docs/rendering/opening-dive.md §4): a strip of quads between each ribbon's margins, its shadow
// first and offset, every vertex carrying the frame and widths the shader paints by, in the order given.

import { describe, expect, it } from 'vitest';
import { KELP_RIBBON_KIND, kelpRibbonArrays, kelpRibbonGeometry, type KelpRibbonDraw } from './kelp-ribbon-geometry';
import type { Ribbon } from './kelp-ribbons';

/** A straight ribbon along x: three samples a metre apart, 0.1 m to the left and 0.2 m to the right. */
const STRAIGHT: Ribbon = {
  lengthM: 2,
  samples: [0, 1, 2].map((arc) => ({ x: arc, y: 0, u: arc, tangentX: 1, tangentY: 0, leftM: 0.1, rightM: 0.2 })),
};

describe('kelpRibbonArrays', () => {
  it('lays two vertices a sample, left margin then right, with their frame, widths and kind', () => {
    const arrays = kelpRibbonArrays([{ ribbon: STRAIGHT, kind: KELP_RIBBON_KIND.stipe, shadowOffset: null }]);
    // left is (−ty, tx): down the screen (+y) for a ribbon along x
    expect(arrays.position.slice(0, 4)).toEqual([0, 0.1, 0, -0.2]);
    expect(arrays.frame.slice(0, 8)).toEqual([1, 0, 0.1, -1, 1, 0, -0.2, -1]);
    expect(arrays.frame.slice(8, 12)).toEqual([1, 0, 0.1, 0]);
    expect(arrays.frame.slice(-4)).toEqual([1, 0, -0.2, 1]);
    expect(arrays.ribbon.slice(0, 4)).toEqual([0, 0.1, 0.2, 2]);
    expect(arrays.style.slice(0, 2)).toEqual([KELP_RIBBON_KIND.stipe, 0]);
    expect(arrays.index).toEqual([0, 2, 3, 0, 3, 1, 2, 4, 5, 2, 5, 3]);
  });

  it('draws a ribbon’s shadow first, offset, then the ribbon, then the next ribbon after both', () => {
    const draws: KelpRibbonDraw[] = [
      { ribbon: STRAIGHT, kind: KELP_RIBBON_KIND.bladeEven, shadowOffset: [0.5, 0.25] },
      { ribbon: STRAIGHT, kind: KELP_RIBBON_KIND.bladeOdd, shadowOffset: null },
    ];
    const arrays = kelpRibbonArrays(draws);
    expect(arrays.position).toHaveLength(3 * 6 * 2);
    expect(arrays.position.slice(0, 2)).toEqual([0.5, 0.35]);
    expect(arrays.position.slice(12, 14)).toEqual([0, 0.1]);
    expect(arrays.style.slice(0, 2)).toEqual([KELP_RIBBON_KIND.bladeEven, 1]);
    expect(arrays.style.slice(12, 14)).toEqual([KELP_RIBBON_KIND.bladeEven, 0]);
    expect(arrays.style.slice(24, 26)).toEqual([KELP_RIBBON_KIND.bladeOdd, 0]);
    expect(arrays.index.slice(12, 15)).toEqual([6, 8, 9]);
    expect(arrays.index.slice(24, 27)).toEqual([12, 14, 15]);
  });
});

describe('kelpRibbonGeometry', () => {
  it('uploads the arrays under the shader’s attribute names, indexed in 32 bits', () => {
    const geometry = kelpRibbonGeometry([{ ribbon: STRAIGHT, kind: KELP_RIBBON_KIND.stipe, shadowOffset: [0, 0] }]);
    expect(Object.keys(geometry.attributes).sort()).toEqual(['aFrame', 'aPosition', 'aRibbon', 'aStyle']);
    expect(geometry.indexBuffer.data).toBeInstanceOf(Uint32Array);
    expect(geometry.indexBuffer.data).toHaveLength(2 * 2 * 6);
    geometry.destroy();
  });
});
