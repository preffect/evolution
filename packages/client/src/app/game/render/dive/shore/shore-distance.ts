// Exact Euclidean distance transforms (docs/rendering/opening-dive.md §4, ticket #801): Felzenszwalb & Huttenlocher's
// squared distance transform, one row or column at a time (the mockup's `edt1d` / `edt2d`). The shallows, the sea floor
// and the live sea's distance field are all functions of how far a pixel of sea is from the coast; the mockup first
// drew them as stacks of round-joined strokes up to ~270 px wide, and every join was a disc the size of the view.

import { DIAMETER_PER_RADIUS } from '../../geometry';

/** What a grid cell holds before the transform: 0 at a feature (land), this far from one otherwise. */
export const FAR_SQUARED = 1e20;

interface Scratch {
  readonly line: Float64Array;
  readonly out: Float64Array;
  readonly sites: Int32Array;
  readonly bounds: Float64Array;
}

function intersection(line: Float64Array, site: number, cell: number): number {
  const siteHeight = (line[site] ?? 0) + site * site;
  const cellHeight = (line[cell] ?? 0) + cell * cell;
  return (cellHeight - siteHeight) / (DIAMETER_PER_RADIUS * (cell - site));
}

/** The lower envelope of the parabolas rooted at each cell of the line: `sites` and where each takes over, `bounds`. */
function lowerEnvelope(scratch: Scratch, count: number): void {
  const { line, sites, bounds } = scratch;
  let last = 0;
  sites[0] = 0;
  bounds[0] = -FAR_SQUARED;
  bounds[1] = FAR_SQUARED;
  for (let cell = 1; cell < count; cell += 1) {
    let crossing = intersection(line, sites[last] ?? 0, cell);
    while (crossing <= (bounds[last] ?? 0)) {
      last -= 1;
      crossing = intersection(line, sites[last] ?? 0, cell);
    }
    last += 1;
    sites[last] = cell;
    bounds[last] = crossing;
    bounds[last + 1] = FAR_SQUARED;
  }
}

/** One row or column, in place in `scratch.out` (`edt1d`). */
function transformLine(scratch: Scratch, count: number): void {
  lowerEnvelope(scratch, count);
  const { line, out, sites, bounds } = scratch;
  let last = 0;
  for (let cell = 0; cell < count; cell += 1) {
    while ((bounds[last + 1] ?? 0) < cell) last += 1;
    const site = sites[last] ?? 0;
    out[cell] = (cell - site) * (cell - site) + (line[site] ?? 0);
  }
}

/** A run of `count` cells `stride` apart from `first`, transformed in place. */
function transformRun(
  grid: Float64Array,
  scratch: Scratch,
  run: { readonly first: number; readonly stride: number; readonly count: number },
): void {
  for (let index = 0; index < run.count; index += 1) scratch.line[index] = grid[run.first + index * run.stride] ?? 0;
  transformLine(scratch, run.count);
  for (let index = 0; index < run.count; index += 1) grid[run.first + index * run.stride] = scratch.out[index] ?? 0;
}

/** The squared distance from every cell of the `width × height` grid to the nearest 0 cell, in place (`edt2d`). */
export function squaredDistanceTransform(grid: Float64Array, width: number, height: number): void {
  const size = Math.max(width, height);
  const scratch: Scratch = {
    line: new Float64Array(size),
    out: new Float64Array(size),
    sites: new Int32Array(size),
    bounds: new Float64Array(size + 1),
  };
  for (let x = 0; x < width; x += 1) transformRun(grid, scratch, { first: x, stride: width, count: height });
  for (let y = 0; y < height; y += 1) transformRun(grid, scratch, { first: y * width, stride: 1, count: width });
}
