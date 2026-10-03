// The live sea's data for one snapshot (docs/rendering/opening-dive.md §4, ticket #801): the signed distance to the
// coast (+ land) on the sea's distance grid, the cells by the waterline taking the exact distance to the refined coast
// so the waterline is the vector coast, not a staircase; and where a stone stands in the water, so the live sea keeps
// off it. The shader lays the water and draws the breakers, the swash and the ripples from them every frame.

import { SHORE_SEA_DATA, SHORE_SEA_GRID } from '../../constants/dive-shore';
import { ALPHA, BLUE, CHANNEL_MAX, GREEN, RED, RGBA_CHANNELS } from '../../colour';
import { HALF } from '../../geometry';
import { boulderPlace, type Boulder } from './shore-boulder';
import type { ShoreCanvas } from './shore-canvas';
import type { ShorePaint } from './shore-paint';
import type { SeaGrid } from './shore-sea-grid';
import { rockPath } from './shore-shapes';

/** The distance grid packed for the GPU: `width × height` RGBA8 cells, `cellsPerMetre` a metre, centred on the focus. */
export interface ShoreSeaData {
  readonly width: number;
  readonly height: number;
  readonly cellsPerMetre: number;
  readonly bytes: Uint8Array;
}

const BYTE_BITS = 8;

/** The signed distance in cells: the grid's two sides, exact by the waterline. */
function signedCells(paint: ShorePaint, grid: SeaGrid): Float64Array {
  const cellM = SHORE_SEA_GRID.cellPx / paint.view.pixelsPerMetre;
  const within = SHORE_SEA_DATA.exactWithinCells;
  const signed = new Float64Array(grid.distances.length);
  for (let row = 0; row < grid.height; row += 1) {
    for (let column = 0; column < grid.width; column += 1) {
      const cell = row * grid.width + column;
      const gridSigned = ((grid.landDistances[cell] ?? 0) - (grid.distances[cell] ?? 0)) / cellM;
      signed[cell] =
        Math.abs(gridSigned) < within ? (exactCells(paint, { column, row, grid, cellM }) ?? gridSigned) : gridSigned;
    }
  }
  return signed;
}

/** The exact signed distance in cells at a cell's centre, or `null` when the coast is not that near. */
function exactCells(
  paint: ShorePaint,
  point: { readonly column: number; readonly row: number; readonly grid: SeaGrid; readonly cellM: number },
): number | null {
  const { column, row, grid, cellM } = point;
  const x = (column + HALF - grid.width * HALF) * cellM;
  const y = (row + HALF - grid.height * HALF) * cellM;
  const exact = paint.coast.distance(x, y, SHORE_SEA_DATA.exactWithinCells * cellM);
  return Number.isNaN(exact) ? null : exact / cellM;
}

function pack(signed: Float64Array): Uint8Array {
  const { cellSteps, offset, maxValue } = SHORE_SEA_DATA;
  const bytes = new Uint8Array(signed.length * RGBA_CHANNELS);
  for (let cell = 0; cell < signed.length; cell += 1) {
    const value = Math.min(maxValue, Math.max(0, Math.round((signed[cell] ?? 0) * cellSteps + offset)));
    const base = cell * RGBA_CHANNELS;
    bytes[base + RED] = value >> BYTE_BITS;
    bytes[base + GREEN] = value & CHANNEL_MAX;
    bytes[base + BLUE] = 0;
    bytes[base + ALPHA] = CHANNEL_MAX;
  }
  return bytes;
}

/** The snapshot's distance grid, packed. */
export function shoreSeaData(paint: ShorePaint, grid: SeaGrid): ShoreSeaData {
  return {
    width: grid.width,
    height: grid.height,
    cellsPerMetre: paint.view.pixelsPerMetre / SHORE_SEA_GRID.cellPx,
    bytes: pack(signedCells(paint, grid)),
  };
}

/**
 * The stones standing in the water, white on clear over the snapshot's extent at `SHORE_SEA_DATA.stonesCellPx` a
 * texel, at their fade; `null` when the level has none.
 */
export function shoreStones(
  paint: ShorePaint,
  stones: { readonly boulders: readonly Boulder[]; readonly alpha: number },
): ShoreCanvas | null {
  const inWater = stones.boulders.filter((boulder) => boulder.heightM < boulder.radius);
  if (inWater.length === 0 || stones.alpha <= 0) return null;
  const { view } = paint;
  const size = {
    width: Math.ceil(view.widthPx / SHORE_SEA_DATA.stonesCellPx),
    height: Math.ceil(view.heightPx / SHORE_SEA_DATA.stonesCellPx),
  };
  const canvas = paint.factory.create(size.width, size.height);
  const scale = view.pixelsPerMetre / SHORE_SEA_DATA.stonesCellPx;
  canvas.context.setTransform(scale, 0, 0, scale, size.width * HALF, size.height * HALF);
  canvas.context.fillStyle = `rgba(${CHANNEL_MAX},${CHANNEL_MAX},${CHANNEL_MAX},${stones.alpha})`;
  for (const boulder of inWater) {
    rockPath(canvas.context, boulderPlace(boulder));
    canvas.context.fill();
  }
  return canvas;
}
