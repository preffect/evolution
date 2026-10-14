// The sea in a snapshot (docs/rendering/opening-dive.md §4): the distance grid and its packed data, the stones in the
// water, the kelp beds offshore and the far surf's rim.

import { describe, expect, it } from 'vitest';
import { SHORE_SEA_DATA, SHORE_SEA_GRID } from '../../constants/dive-shore';
import { CHANNEL_MAX } from '../../colour';
import { testShorePaint } from '../../../../../testing/shore-paint-builder';
import { drawKelpBeds } from './shore-kelp-beds';
import { drawSea } from './shore-sea';
import { shoreSeaData, shoreStones } from './shore-sea-data';
import { capHalfWidth, seaGridOf, seaGridSize } from './shore-sea-grid';

const RGBA = 4;

/** The signed distance in metres the data packs for a cell (+ land). */
function unpacked(bytes: Uint8Array, cell: number, cellsPerMetre: number): number {
  const packed = (bytes[cell * RGBA] ?? 0) * (CHANNEL_MAX + 1) + (bytes[cell * RGBA + 1] ?? 0);
  return (packed - SHORE_SEA_DATA.offset) / SHORE_SEA_DATA.cellSteps / cellsPerMetre;
}

describe('seaGridOf', () => {
  it('is a sixth of the view’s resolution plus a pad, centred on the view', () => {
    const paint = testShorePaint(2.5);
    const size = seaGridSize(paint);
    expect(size.width).toBe(Math.ceil(paint.view.widthPx / SHORE_SEA_GRID.cellPx) + SHORE_SEA_GRID.padCells);
    const grid = seaGridOf(paint);
    expect(grid.distances).toHaveLength(size.width * size.height);
    expect(grid.landDistances).toHaveLength(size.width * size.height);
  });

  it('caps a stroke’s reach at 0.9 of the coast’s margin', () => {
    const paint = testShorePaint(2.5);
    expect(capHalfWidth(paint, 1e9)).toBeCloseTo(paint.coast.marginM * SHORE_SEA_GRID.marginShare, 9);
    expect(capHalfWidth(paint, 3)).toBe(3);
  });
});

/** A paint whose rasterised land is the northern half of every grid: land above the middle row, sea below. */
function halfLandPaint(zoom: number) {
  const paint = testShorePaint(zoom);
  const create = paint.factory.create.bind(paint.factory);
  paint.factory.create = (width, height) => {
    const canvas = create(width, height);
    canvas.context.getImageData = (_left, _top, readWidth, readHeight) => {
      const data = new Uint8ClampedArray(readWidth * readHeight * RGBA);
      for (let row = 0; row < readHeight / 2; row += 1) {
        for (let column = 0; column < readWidth; column += 1) data[(row * readWidth + column) * RGBA + 3] = CHANNEL_MAX;
      }
      return { width: readWidth, height: readHeight, data };
    };
    return canvas;
  };
  return paint;
}

describe('the distance grid over land and sea', () => {
  it('measures sea cells from the land and land cells from the sea, each growing away from the shore', () => {
    const paint = halfLandPaint(2.5);
    const grid = seaGridOf(paint);
    const column = Math.floor(grid.width / 2);
    const cellAt = (row: number): number => row * grid.width + column;
    expect(grid.distances[cellAt(1)]).toBe(0);
    expect(grid.landDistances[cellAt(1)]).toBeGreaterThan(grid.landDistances[cellAt(Math.floor(grid.height / 2) - 2)]!);
    expect(grid.landDistances[cellAt(grid.height - 2)]).toBe(0);
    expect(grid.distances[cellAt(grid.height - 2)]).toBeGreaterThan(
      grid.distances[cellAt(Math.floor(grid.height / 2) + 2)]!,
    );
    expect(grid.maxDistance).toBeGreaterThan(0);
  });

  it('packs the signed distance at the grid’s cell: + on land, − at sea', () => {
    const paint = halfLandPaint(2.5);
    const grid = seaGridOf(paint);
    const data = shoreSeaData(paint, grid);
    expect(data.cellsPerMetre).toBeCloseTo(paint.view.pixelsPerMetre / SHORE_SEA_GRID.cellPx, 9);
    expect(data.bytes).toHaveLength(grid.width * grid.height * RGBA);
    const column = Math.floor(grid.width / 2);
    const landCell = 1 * grid.width + column;
    const seaCell = (grid.height - 2) * grid.width + column;
    expect(unpacked(data.bytes, landCell, data.cellsPerMetre)).toBeGreaterThan(0);
    expect(unpacked(data.bytes, seaCell, data.cellsPerMetre)).toBeCloseTo(-grid.distances[seaCell]!, 1);
  });
});

describe('shoreStones', () => {
  it('draws only the stones that reach the water, at their fade, and nothing when none does', () => {
    const paint = testShorePaint(1);
    const inWater = { x: 0, y: 2, radius: 1, seed: 3, heightM: -0.5 };
    const dry = { x: 0, y: -4, radius: 1, seed: 4, heightM: 6 };
    expect(shoreStones(paint, { boulders: [dry], alpha: 1 })).toBeNull();
    expect(shoreStones(paint, { boulders: [inWater], alpha: 0 })).toBeNull();
    const stones = shoreStones(paint, { boulders: [inWater, dry], alpha: 0.6 });
    expect(stones).not.toBeNull();
    expect(paint.factory.canvases.at(-1)!.context.count('fill')).toBe(1);
    expect(stones!.width).toBe(Math.ceil(paint.view.widthPx / SHORE_SEA_DATA.stonesCellPx));
  });
});

describe('drawSea', () => {
  it('clips to the sea and draws the far surf’s rim only far out', () => {
    const far = testShorePaint(4.2);
    drawSea(far);
    expect(far.context.clipRules).toEqual(['evenodd']);
    expect(far.context.count('stroke')).toBe(1);
    const near = testShorePaint(3);
    drawSea(near);
    const bedsOnly = testShorePaint(3);
    drawKelpBeds(bedsOnly);
    expect(near.context.count('stroke')).toBe(bedsOnly.context.count('stroke'));
  });
});

describe('drawKelpBeds', () => {
  it('draws nothing above z 4.1, the hand-placed beds that lie offshore below it', () => {
    const far = testShorePaint(4.3);
    drawKelpBeds(far);
    expect(far.context.paintCount).toBe(0);
    const near = testShorePaint(2.9);
    drawKelpBeds(near);
    expect(near.context.count('ellipse')).toBeGreaterThan(0);
  });

  it('adds single plants to a bed in view below z 2.3: a bulb and its shadow each', () => {
    const wide = {
      ...testShorePaint(2).view,
      halfWidthM: 1000,
      halfHeightM: 1000,
      pixelsPerMetre: 1,
      screenPixelsPerMetre: 1,
    };
    const paint = testShorePaint(2, wide);
    drawKelpBeds(paint);
    const bulbs = paint.context.count('arc');
    expect(bulbs).toBeGreaterThan(0);
    expect(bulbs % 2).toBe(0);
    const above = testShorePaint(2.4, { ...wide, zoom: 2.4 });
    drawKelpBeds(above);
    expect(above.context.count('arc')).toBe(0);
  });
});
