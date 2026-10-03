// Block-culled scatter near the coast (docs/rendering/opening-dive.md §4, ticket #801, the mockup's `nearCoastCells`):
// grid cells whose distance up the shore lies in a range, each a world-stable choice by the hash, so a pool or a
// boulder sits in the same place at every zoom. A block of cells is tested against the coast once before its cells.

import { SHORE_NEAR_CELLS } from '../../constants/dive-shore-objects';
import { HALF } from '../../geometry';
import { coordinateHash } from './shore-noise';
import { isInView, type ShorePaint } from './shore-paint';

/** One cell's choice: where it lies, its two rolls, its distance up the shore and its grid place. */
export interface NearCoastCell {
  readonly x: number;
  readonly y: number;
  /** The cell's first roll (`a`): what decides whether it holds anything. */
  readonly roll: number;
  /** Its second roll (`b`): the thing's size or turn. */
  readonly size: number;
  /** Signed distance up the shore in metres (+ land). */
  readonly distanceM: number;
  readonly column: number;
  readonly row: number;
}

/** The scatter: cells `cellM` apart, `fromM` to `toM` up the shore, hashed with `salt`, at most `maxCells`. */
export interface NearCoastScatter {
  readonly cellM: number;
  readonly fromM: number;
  readonly toM: number;
  readonly salt: number;
  readonly maxCells: number;
}

const SALT_X = 0;
const SALT_Y = 1;
const SALT_ROLL = 2;
const SALT_SIZE = 3;

function blockRange(
  paint: ShorePaint,
  blockM: number,
): { column0: number; column1: number; row0: number; row1: number } {
  const { view } = paint;
  return {
    column0: Math.floor(-view.halfWidthM / blockM) - 1,
    column1: Math.floor(view.halfWidthM / blockM) + 1,
    row0: Math.floor(-view.halfHeightM / blockM) - 1,
    row1: Math.floor(view.halfHeightM / blockM) + 1,
  };
}

function cellAt(
  paint: ShorePaint,
  scatter: NearCoastScatter,
  place: { readonly column: number; readonly row: number },
): NearCoastCell | null {
  const { column, row } = place;
  const roll = coordinateHash(column, row, scatter.salt + SALT_ROLL);
  if (roll > SHORE_NEAR_CELLS.skipAbove) return null;
  const x = (column + coordinateHash(column, row, scatter.salt + SALT_X)) * scatter.cellM;
  const y = (row + coordinateHash(column, row, scatter.salt + SALT_Y)) * scatter.cellM;
  if (!isInView(paint.view, { x, y }, scatter.cellM * SHORE_NEAR_CELLS.visibleCells)) return null;
  const reach = Math.max(Math.abs(scatter.fromM), Math.abs(scatter.toM)) + scatter.cellM;
  const distanceM = paint.coast.distance(x, y, reach);
  if (Number.isNaN(distanceM) || distanceM < scatter.fromM || distanceM > scatter.toM) return null;
  return { x, y, roll, size: coordinateHash(column, row, scatter.salt + SALT_SIZE), distanceM, column, row };
}

function isBlockNear(
  paint: ShorePaint,
  scatter: NearCoastScatter,
  block: { readonly column: number; readonly row: number },
): boolean {
  const blockM = scatter.cellM * SHORE_NEAR_CELLS.blockCells;
  const reach = Math.max(Math.abs(scatter.fromM), Math.abs(scatter.toM)) + blockM;
  const distance = paint.coast.distance((block.column + HALF) * blockM, (block.row + HALF) * blockM, reach);
  return !Number.isNaN(distance) && distance >= scatter.fromM - blockM && distance <= scatter.toM + blockM;
}

/** A block's cells near the coast, appended to `cells`; `false` once the scatter is full. */
function addBlockCells(
  paint: ShorePaint,
  scatter: NearCoastScatter,
  block: { readonly column: number; readonly row: number },
  cells: NearCoastCell[],
): boolean {
  const size = SHORE_NEAR_CELLS.blockCells;
  for (let index = 0; index < size * size; index += 1) {
    const column = block.column * size + Math.floor(index / size);
    const row = block.row * size + (index % size);
    const cell = cellAt(paint, scatter, { column, row });
    if (cell === null) continue;
    if (cells.length >= scatter.maxCells) return false;
    cells.push(cell);
  }
  return true;
}

/** Every cell of the scatter near the coast in view, in the mockup's order; none when the view holds too many. */
export function nearCoastCells(paint: ShorePaint, scatter: NearCoastScatter): NearCoastCell[] {
  const size = SHORE_NEAR_CELLS.blockCells;
  const range = blockRange(paint, scatter.cellM * size);
  const columns = range.column1 - range.column0 + 1;
  const blocks = columns * (range.row1 - range.row0 + 1);
  if (blocks * size * size > scatter.maxCells * SHORE_NEAR_CELLS.blockBudget) return [];
  const cells: NearCoastCell[] = [];
  for (let index = 0; index < blocks; index += 1) {
    const block = {
      column: range.column0 + Math.floor(index / (range.row1 - range.row0 + 1)),
      row: range.row0 + (index % (range.row1 - range.row0 + 1)),
    };
    if (isBlockNear(paint, scatter, block) && !addBlockCells(paint, scatter, block, cells)) break;
  }
  return cells;
}
