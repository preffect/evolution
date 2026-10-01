// How far each bit of sea is from the land, on a grid a sixth of the view's resolution (docs/rendering/opening-dive.md
// §4, ticket #801, the mockup's `seaDistance`): an exact distance transform of the land mask, plus a coarser grid of
// the land beyond it (the shallows reach up to 9 km past the view). The shallows and the sea floor's mask are both
// ramps of this one number.

import { SHORE_SEA_GRID } from '../../constants/dive-shore';
import { DIAMETER_PER_RADIUS, HALF } from '../../geometry';
import type { ShoreCanvas } from './shore-canvas';
import { FAR_SQUARED, squaredDistanceTransform } from './shore-distance';
import { coastPoints, ringsPath, type ShorePaint } from './shore-paint';

/** The grid: `width × height` cells of `SHORE_SEA_GRID.cellPx` CSS px, centred on the view, distances in metres. */
export interface SeaGrid {
  readonly width: number;
  readonly height: number;
  /** From each cell of sea to the nearest land; 0 on land. */
  readonly distances: Float32Array;
  /** From each cell of land to the nearest sea in the fine grid; 0 at sea. */
  readonly landDistances: Float32Array;
  readonly maxDistance: number;
}

/** How far each land cell lies from the sea, in cells squared: the land mask turned inside out, transformed. */
function landSide(grid: Float64Array, fine: { readonly width: number; readonly height: number }): Float64Array {
  const inland = new Float64Array(grid.length);
  for (let cell = 0; cell < grid.length; cell += 1) inland[cell] = grid[cell] === 0 ? FAR_SQUARED : 0;
  squaredDistanceTransform(inland, fine.width, fine.height);
  return inland;
}

/** A coarse cell further than this counts as no land at all. */
const NO_LAND_SQUARED = 1e19;
/** A distance to "no land" in metres: past every ramp. */
const NO_LAND_M = 1e9;
const UNBOUNDED_M = 1e30;
/** A land texel is one whose coverage reaches half (`img[i * 4 + 3] >= 128`). */
const LAND_ALPHA = 128;
const ALPHA_OFFSET = 3;
const RGBA = 4;
/** The last cell with a neighbour after it lies this far from a row's or a column's end. */
const NEIGHBOURED_FROM_END = 2;

/** The grid size for the view (`seaGrid`). */
export function seaGridSize(paint: ShorePaint): { readonly width: number; readonly height: number } {
  const { cellPx, padCells } = SHORE_SEA_GRID;
  return {
    width: Math.ceil(paint.view.widthPx / cellPx) + padCells,
    height: Math.ceil(paint.view.heightPx / cellPx) + padCells,
  };
}

/** The half-width a stroke may reach past the view: the coast's margin bounds it (`capHalf`). */
export function capHalfWidth(paint: ShorePaint, halfWidthM: number): number {
  return Math.min(halfWidthM, paint.coast.marginM * SHORE_SEA_GRID.marginShare);
}

/** The land rasterised on a `width × height` grid at `scale` cells per metre: 0 on land, `FAR_SQUARED` at sea. */
function landGrid(
  paint: ShorePaint,
  size: { readonly width: number; readonly height: number },
  scale: number,
): Float64Array {
  const canvas: ShoreCanvas = paint.factory.create(size.width, size.height);
  const context = canvas.context;
  context.setTransform(scale, 0, 0, scale, size.width * HALF, size.height * HALF);
  ringsPath(context, coastPoints(paint.coast.rings));
  context.fillStyle = '#fff';
  context.fill('nonzero');
  const data = context.getImageData(0, 0, size.width, size.height).data;
  const grid = new Float64Array(size.width * size.height);
  for (let cell = 0; cell < grid.length; cell += 1)
    grid[cell] = (data[cell * RGBA + ALPHA_OFFSET] ?? 0) >= LAND_ALPHA ? 0 : FAR_SQUARED;
  return grid;
}

interface CoarseGrid {
  readonly grid: Float64Array;
  readonly width: number;
  readonly height: number;
  /** Fine cells per coarse cell. */
  readonly factor: number;
}

/** The coarse grid's size: as fine as fits `SHORE_SEA_GRID.coarseMaxCells`, reaching `reachM` past the fine grid. */
function coarseSize(
  fine: { readonly width: number; readonly height: number },
  reachCells: number,
): { width: number; height: number; factor: number } {
  let factor = SHORE_SEA_GRID.coarseFactor;
  for (;;) {
    const margin = Math.ceil(reachCells / factor) + 1;
    const width = Math.ceil(fine.width / factor) + DIAMETER_PER_RADIUS * margin;
    const height = Math.ceil(fine.height / factor) + DIAMETER_PER_RADIUS * margin;
    if (width * height <= SHORE_SEA_GRID.coarseMaxCells) return { width, height, factor };
    factor *= SHORE_SEA_GRID.coarseGrowth;
  }
}

/** Land past the fine grid; land inside it is left out, since the fine grid has it exactly. */
function coarseGrid(
  paint: ShorePaint,
  fine: { readonly width: number; readonly height: number },
  reachM: number,
): CoarseGrid {
  const pixelsPerCell = SHORE_SEA_GRID.cellPx;
  const size = coarseSize(fine, (reachM * paint.view.pixelsPerMetre) / pixelsPerCell);
  const grid = landGrid(paint, size, paint.view.pixelsPerMetre / (pixelsPerCell * size.factor));
  for (let row = 0; row < size.height; row += 1) {
    const fineY = (row - size.height * HALF) * size.factor + fine.height * HALF;
    if (fineY < 0 || fineY + size.factor > fine.height) continue;
    for (let column = 0; column < size.width; column += 1) {
      const fineX = (column - size.width * HALF) * size.factor + fine.width * HALF;
      if (fineX >= 0 && fineX + size.factor <= fine.width) grid[row * size.width + column] = FAR_SQUARED;
    }
  }
  squaredDistanceTransform(grid, size.width, size.height);
  return { grid, width: size.width, height: size.height, factor: size.factor };
}

function coarseMetres(squared: number, cellM: number): number {
  return squared >= NO_LAND_SQUARED ? NO_LAND_M : (Math.sqrt(squared) - HALF) * cellM;
}

/** The coarse distance at a fine cell, bilinear between the coarse cells' centres. */
function coarseDistanceAt(
  coarse: CoarseGrid,
  fine: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  cellM: number,
): number {
  const centreX = (fine.x + HALF - fine.width * HALF) / coarse.factor + coarse.width * HALF - HALF;
  const centreY = (fine.y + HALF - fine.height * HALF) / coarse.factor + coarse.height * HALF - HALF;
  const column = Math.min(coarse.width - NEIGHBOURED_FROM_END, Math.max(0, Math.floor(centreX)));
  const row = Math.min(coarse.height - NEIGHBOURED_FROM_END, Math.max(0, Math.floor(centreY)));
  const fractionX = Math.min(1, Math.max(0, centreX - column));
  const fractionY = Math.min(1, Math.max(0, centreY - row));
  const point = (deltaX: number, deltaY: number): number =>
    coarseMetres(coarse.grid[(row + deltaY) * coarse.width + column + deltaX] ?? FAR_SQUARED, cellM * coarse.factor);
  const top = point(0, 0) + (point(1, 0) - point(0, 0)) * fractionX;
  const bottom = point(0, 1) + (point(1, 1) - point(0, 1)) * fractionX;
  return top + (bottom - top) * fractionY;
}

/** The fine grid's largest squared distance inside the view's part of it: how far the sea strokes can need land. */
function farthestSquared(
  grid: Float64Array,
  fine: { readonly width: number },
  size: { readonly width: number; readonly height: number },
): number {
  const pad = SHORE_SEA_GRID.padFineCells;
  let farthest = 0;
  for (let y = 0; y < size.height; y += 1) {
    for (let x = 0; x < size.width; x += 1) farthest = Math.max(farthest, grid[(y + pad) * fine.width + x + pad] ?? 0);
  }
  return farthest;
}

/** A fine cell's distance to land in metres: the fine grid's, or the coarse grid's when its land is nearer. */
function seaMetres(squared: number, coarseMetres: () => number, cellM: number): number {
  if (squared === 0) return 0;
  return Math.min((Math.sqrt(squared) - HALF) * cellM, coarseMetres());
}

/** The distance from each cell to the nearest land, in metres (`seaDistance`), and from each land cell to the sea. */
export function seaGridOf(paint: ShorePaint): SeaGrid {
  const size = seaGridSize(paint);
  const pad = SHORE_SEA_GRID.padFineCells;
  const fine = { width: size.width + DIAMETER_PER_RADIUS * pad, height: size.height + DIAMETER_PER_RADIUS * pad };
  const cellM = SHORE_SEA_GRID.cellPx / paint.view.pixelsPerMetre;
  const grid = landGrid(paint, fine, paint.view.pixelsPerMetre / SHORE_SEA_GRID.cellPx);
  const inland = landSide(grid, fine);
  squaredDistanceTransform(grid, fine.width, fine.height);
  const farthest = farthestSquared(grid, fine, size);
  const widest = capHalfWidth(paint, SHORE_SEA_GRID.widestStrokeM);
  const reachM = Math.min(widest, farthest >= NO_LAND_SQUARED ? UNBOUNDED_M : Math.sqrt(farthest) * cellM);
  const coarse = coarseGrid(paint, fine, reachM);
  const distances = new Float32Array(size.width * size.height);
  const landDistances = new Float32Array(size.width * size.height);
  for (let cell = 0; cell < distances.length; cell += 1) {
    const x = cell % size.width;
    const y = Math.floor(cell / size.width);
    const fineCell = (y + pad) * fine.width + x + pad;
    const inlandSquared = inland[fineCell] ?? 0;
    landDistances[cell] = inlandSquared === 0 ? 0 : (Math.sqrt(inlandSquared) - HALF) * cellM;
    const coarseAt = (): number => coarseDistanceAt(coarse, { x: x + pad, y: y + pad, ...fine }, cellM);
    distances[cell] = seaMetres(grid[fineCell] ?? 0, coarseAt, cellM);
  }
  return {
    ...size,
    distances,
    landDistances,
    maxDistance: distances.reduce((most, metres) => Math.max(most, metres), 0),
  };
}
