// The spray beads on blade 0 (docs/rendering/opening-dive.md §4, ticket #802, the mockup's `drawBeads` and `forCells`):
// one bead in half the cells of a world-stable grid, inside the blade's margins and clear of the drop, placed once a
// page in the order the mockup draws them. Each frame only says whether they show: the mockup drew none while the view
// held more cells than its cap, or until a millimetre spanned a few pixels.

import { KELP_BEAD_FIELD_M, KELP_BEADS, KELP_DROP, KELP_GRID_PAD_CELLS } from '../../constants/dive-kelp-drop';
import { KELP_BLADE, KELP_GRID_SALT } from '../../constants/dive-kelp';
import type { DiveCamera } from '../dive-camera';
import { coordinateHash } from '../shore/shore-noise';
import type { CurveSample } from './kelp-ribbons';

/** A bead: its centre and radius in metres. */
export interface KelpBead {
  readonly x: number;
  readonly y: number;
  readonly radiusM: number;
}

/** A cell of a world-stable grid (`forCells`): its jittered point and its two rolls. */
export interface GridCell {
  readonly x: number;
  readonly y: number;
  readonly first: number;
  readonly second: number;
}

const MILLIMETRES_PER_METRE = 1000;

/** Cell `(column, row)` of a `cellM` grid salted `salt`: `fn(i, j, (i + hash) × cell, (j + hash) × cell, a, b)`. */
export function gridCell(
  column: number,
  row: number,
  grid: { readonly cellM: number; readonly salt: number },
): GridCell {
  return {
    x: (column + coordinateHash(column, row, grid.salt + KELP_GRID_SALT.x)) * grid.cellM,
    y: (row + coordinateHash(column, row, grid.salt + KELP_GRID_SALT.y)) * grid.cellM,
    first: coordinateHash(column, row, grid.salt + KELP_GRID_SALT.first),
    second: coordinateHash(column, row, grid.salt + KELP_GRID_SALT.second),
  };
}

/** The cells along one axis `forCells` visits over `±halfM`: one past the view on each side. */
function cellsAcross(halfM: number, cellM: number): number {
  const first = Math.floor(-halfM / cellM) - KELP_GRID_PAD_CELLS;
  const last = Math.floor(halfM / cellM) + KELP_GRID_PAD_CELLS;
  return last - first + 1;
}

/** How many cells of a `cellM` grid `forCells` visits over the view: what its cap is checked against. */
export function cellsInView(camera: DiveCamera, cellM: number): number {
  return cellsAcross(camera.halfWidthM, cellM) * cellsAcross(camera.halfHeightM, cellM);
}

/** Whether a bead at `(x, y)` lies on blade 0, within its share of the width of every `sampleStride`-th sample. */
function isOnBlade(x: number, y: number, blade: readonly CurveSample[]): boolean {
  const reach = KELP_BLADE.widthM * KELP_BEADS.onBladeShare;
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < blade.length; index += KELP_BEADS.sampleStride) {
    const sample = blade[index];
    if (sample !== undefined) nearest = Math.min(nearest, Math.hypot(sample.x - x, sample.y - y));
  }
  return nearest <= reach;
}

/** The bead in a cell, or `null` when the cell has none. */
function beadIn(cell: GridCell, blade: readonly CurveSample[]): KelpBead | null {
  const beads = KELP_BEADS;
  if (cell.first > beads.keepAtOrBelow) return null;
  const radiusM = beads.radiusM.min + cell.second * cell.second * beads.radiusM.span;
  const fromDrop = Math.hypot(cell.x - KELP_DROP.x, cell.y - KELP_DROP.y);
  if (fromDrop < KELP_DROP.radiusM + radiusM + beads.clearOfDropM) return null;
  return isOnBlade(cell.x, cell.y, blade) ? { x: cell.x, y: cell.y, radiusM } : null;
}

/**
 * Every bead within `KELP_BEAD_FIELD_M` of the focus, column by column as `forCells` draws them, a column a step.
 * Wider than any view the beads show in (the cell cap keeps them to well under a metre across).
 */
export function* placeBeads(blade: readonly CurveSample[]): Generator<void, KelpBead[]> {
  const grid = { cellM: KELP_BEADS.cellM, salt: KELP_BEADS.salt };
  const last = Math.floor(KELP_BEAD_FIELD_M / grid.cellM);
  const beads: KelpBead[] = [];
  for (let column = -last; column <= last; column += 1) {
    for (let row = -last; row <= last; row += 1) {
      const bead = beadIn(gridCell(column, row, grid), blade);
      if (bead !== null) beads.push(bead);
    }
    yield;
  }
  return beads;
}

/** Whether the beads show at `camera`: a millimetre spans enough pixels, above their cut, under the cell cap. */
export function areBeadsShown(camera: DiveCamera): boolean {
  const beads = KELP_BEADS;
  return (
    camera.pixelsPerMetre / MILLIMETRES_PER_METRE > beads.pxPerMm &&
    camera.zoom > beads.hideAtOrBelowZoom &&
    cellsInView(camera, beads.cellM) <= beads.maxCells
  );
}
