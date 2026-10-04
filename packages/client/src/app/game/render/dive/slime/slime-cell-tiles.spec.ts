// The kelp's surface cells as two tiles (docs/rendering/opening-dive.md §4, ticket #803): the mockup's sites on its
// brick-offset grid bit for bit, a field whose walls wrap across the tile's seams, the two looks' colours by the
// mockup's formulas, and the bake in many short steps over a small tile.

import { describe, expect, it } from 'vitest';
import { SLIME_CELL_GEOMETRY, SLIME_CELLS_BRIGHT } from '../../constants/dive-slime-cells';
import { createFakeShoreCanvasFactory } from '../../../../../testing/fake-shore-canvas';
import { SLIME_BAKE_TEST_TIMEOUT_MS, SLIME_TEST_CELL_TILE_PX, runBake } from '../../../../../testing/slime-builder';
import { coordinateHash } from '../shore/shore-noise';
import { bakeCellTiles, brightCellColour, cellField, cellSites, darkCellColour } from './slime-cell-tiles';

describe('cellSites', () => {
  it('jitters a site in every cell of the grid, every other row offset half a cell, as the mockup did', () => {
    const sites = cellSites();
    const { columns, rows } = SLIME_CELL_GEOMETRY;
    expect(sites).toHaveLength(columns * rows);
    const site = sites[1 * columns + 2]!;
    expect(site.across).toBeCloseTo((2 + 0.5 + 0.5 + (coordinateHash(2, 1, 311) - 0.5) * 0.5) / columns, 12);
    expect(site.down).toBeCloseTo((1 + 0.5 + (coordinateHash(2, 1, 312) - 0.5) * 0.35) / rows, 12);
    expect(site.shade).toBe(coordinateHash(2, 1, 313));
  });
});

describe('cellField', () => {
  it('gives every cell its pixels and finds the walls between them, a few rows a step', () => {
    const size = SLIME_TEST_CELL_TILE_PX * 2;
    const { result: field, steps } = runBake(cellField(cellSites(), size));
    expect(steps).toBe(size / SLIME_CELL_GEOMETRY.rowsStep);
    expect(new Set(field.site).size).toBe(SLIME_CELL_GEOMETRY.columns * SLIME_CELL_GEOMETRY.rows);
    expect(Math.min(...field.edge)).toBeLessThan(1);
    expect(Math.max(...field.edge)).toBeGreaterThan(1);
  });
});

describe('the cells’ colours', () => {
  it('paints the wall bright in bright field and grooves the cell just inside it', () => {
    const out = { red: 0, green: 0, blue: 0, alpha: 0 };
    brightCellColour({ edge: 0, centre: 100, shade: 0.5 }, 1024, out);
    expect([out.red, out.green, out.blue]).toEqual([227, 201, 138]);
    const grooved = { ...out };
    brightCellColour({ edge: SLIME_CELLS_BRIGHT.groove.atPx, centre: 100, shade: 0.5 }, 1024, grooved);
    const body = { ...out };
    brightCellColour({ edge: 20, centre: 100, shade: 0.5 }, 1024, body);
    expect(grooved.red).toBeLessThan(body.red);
    expect(out.alpha).toBe(255);
  });

  it('glows the wall over the dark in dark field, and leaves the cell dark', () => {
    const wall = { red: 0, green: 0, blue: 0, alpha: 0 };
    darkCellColour(0, wall);
    expect(wall.red).toBeCloseTo(227 * 1.02 + 11, 9);
    const inside = { red: 0, green: 0, blue: 0, alpha: 0 };
    darkCellColour(60, inside);
    expect(inside.red).toBeLessThan(12);
  });
});

describe('bakeCellTiles', () => {
  it(
    'bakes both looks from one field in many short steps, each with its plastids drawn over',
    () => {
      const factory = createFakeShoreCanvasFactory();
      const { result, steps } = runBake(bakeCellTiles(factory, SLIME_TEST_CELL_TILE_PX));
      expect(steps).toBeGreaterThan(SLIME_TEST_CELL_TILE_PX / SLIME_CELL_GEOMETRY.rowsStep);
      expect(factory.canvases).toEqual([result.bright, result.dark]);
      for (const tile of factory.canvases) {
        expect(tile.width).toBe(SLIME_TEST_CELL_TILE_PX);
        expect(tile.context.ops).toContain('putImageData');
        expect(tile.context.ops.filter((name) => name === 'ellipse').length).toBeGreaterThan(
          SLIME_CELL_GEOMETRY.columns,
        );
      }
    },
    SLIME_BAKE_TEST_TIMEOUT_MS,
  );
});
