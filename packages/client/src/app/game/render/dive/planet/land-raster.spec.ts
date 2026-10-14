// @vitest-environment node
// The coastline bakes' land mask (docs/rendering/opening-dive.md §4): polygons filled nonzero at texel centres, as a
// path context `d3.geoPath` draws into.

import { describe, expect, it } from 'vitest';
import { LAND, LandRaster } from './land-raster';

function filled(raster: LandRaster): Uint8Array {
  const job = raster.fill();
  for (let step = job.next(); ; step = job.next()) if (step.done === true) return step.value;
}

interface Square {
  readonly left: number;
  readonly top: number;
  readonly size: number;
}

function square(raster: LandRaster, { left, top, size }: Square, isClockwise = true): void {
  raster.moveTo(left, top);
  const corners: [number, number][] = isClockwise
    ? [
        [left + size, top],
        [left + size, top + size],
        [left, top + size],
      ]
    : [
        [left, top + size],
        [left + size, top + size],
        [left + size, top],
      ];
  for (const [x, y] of corners) raster.lineTo(x, y);
  raster.closePath();
}

function landTexels(mask: Uint8Array, width: number): string[] {
  return [...mask.keys()]
    .filter((index) => mask[index] === LAND)
    .map((index) => `${index % width},${Math.floor(index / width)}`);
}

describe('LandRaster', () => {
  it('fills the texels whose centres a polygon covers, and no others', () => {
    const raster = new LandRaster(6, 6);
    square(raster, { left: 1, top: 1, size: 2.6 });
    expect(landTexels(filled(raster), 6)).toEqual(['1,1', '2,1', '3,1', '1,2', '2,2', '3,2', '1,3', '2,3', '3,3']);
  });

  it('fills by the nonzero rule: two rings wound alike add, a ring wound against one cuts a hole', () => {
    const overlapping = new LandRaster(6, 1);
    square(overlapping, { left: 0, top: 0, size: 3 });
    square(overlapping, { left: 2, top: 0, size: 3 });
    expect(landTexels(filled(overlapping), 6)).toEqual(['0,0', '1,0', '2,0', '3,0', '4,0']);
    const holed = new LandRaster(5, 5);
    square(holed, { left: 0, top: 0, size: 5 });
    square(holed, { left: 2, top: 2, size: 1 }, false);
    const mask = filled(holed);
    expect(mask[2 * 5 + 2]).toBe(0);
    expect(landTexels(mask, 5)).toHaveLength(24);
  });

  it('closes an open ring, keeps what falls outside the mask out of it, and draws no land for a point', () => {
    const raster = new LandRaster(4, 4);
    raster.beginPath();
    raster.moveTo(-2, -2);
    raster.lineTo(2, -2);
    raster.lineTo(2, 2);
    raster.lineTo(-2, 2);
    raster.arc();
    expect(landTexels(filled(raster), 4)).toEqual(['0,0', '1,0', '0,1', '1,1']);
  });

  it('yields every 64 rows, so a bake runs in slices', () => {
    const raster = new LandRaster(2, 130);
    const job = raster.fill();
    let yields = 0;
    for (let step = job.next(); step.done !== true; step = job.next()) yields += 1;
    expect(yields).toBe(2);
  });
});
