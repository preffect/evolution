import { describe, expect, it } from 'vitest';
import {
  CAMERA_MAX_VIEW_HALF_HEIGHT_WU,
  CAMERA_MIN_VIEW_HALF_HEIGHT_WU,
  CAMERA_VIEW_RADIUS_EXPONENT,
  DEFAULT_BALANCE,
  INTEREST_VIEW_ASPECT_RATIO,
  markdownSection,
  radiusForMass,
  tableRows,
  viewHalfHeightFor,
} from '@evolution/shared';
import { readRepoDocument } from '../../../testing/repo-document';
// The follow and the zoom are shared and tested with them (`shared/src/camera/camera-follow.test.ts`); Z1's view
// half-height is shared too, and pinned here against §7's table.
import {
  cameraExtent,
  drawnWidthPx,
  hasViewportHeight,
  isDiscVisibleInExtent,
  screenOffsetToWorld,
  screenToWorld,
  worldToScreen,
  zoomFor,
} from './camera';
import { HALF } from './geometry';

const VIEWPORT = { width: 1920, height: 1080 };
const FLOAT_SLACK = 1e-9;
const SPAWN_RADIUS_WU = radiusForMass(DEFAULT_BALANCE.growth.CELL_STARTING_MASS, DEFAULT_BALANCE.growth);

/** A number as game-design/controls-and-scope.md §7's table prints it, with half its last digit as the tolerance. */
function printedNumber(cell: string | undefined): { value: number; tolerance: number } {
  const match = /\d+(?:\.(\d+))?/.exec(cell ?? '');
  if (match === null) throw new Error(`controls-and-scope.md §7 table: no number in "${cell}"`);
  return { value: Number(match[0]), tolerance: HALF * 10 ** -(match[1]?.length ?? 0) };
}

function expectAsPrinted(actual: number, cell: string | undefined, label: string): void {
  const printed = printedNumber(cell);
  expect(Math.abs(actual - printed.value), label).toBeLessThanOrEqual(printed.tolerance + FLOAT_SLACK);
}

/** §7's table rows: mass, radius, view half-height, radii ahead, own cell px at 800 and at 1080 px tall. */
function cameraTable(): string[][] {
  const section = markdownSection(readRepoDocument('docs/game-design/controls-and-scope.md'), '## 7. ');
  return tableRows(section).filter(([massCell = '']) => /^\d/.test(massCell));
}

function ownCellPx(radius: number, viewportHeightPx: number): number {
  return zoomFor({ x: 0, y: 0, viewHalfHeightWu: viewHalfHeightFor(radius) }, { width: 0, height: viewportHeightPx });
}

describe('viewHalfHeightFor', () => {
  it('sits on the zoom-in limit at the starting radius and below it', () => {
    expect(viewHalfHeightFor(SPAWN_RADIUS_WU)).toBeCloseTo(CAMERA_MIN_VIEW_HALF_HEIGHT_WU, 9);
    expect(viewHalfHeightFor(1)).toBe(CAMERA_MIN_VIEW_HALF_HEIGHT_WU);
    expect(viewHalfHeightFor(10_000)).toBe(CAMERA_MAX_VIEW_HALF_HEIGHT_WU);
  });

  it('grows with the radius to CAMERA_VIEW_RADIUS_EXPONENT between the limits, more slowly than the cell', () => {
    const quadrupled = SPAWN_RADIUS_WU * 4;
    expect(viewHalfHeightFor(quadrupled)).toBeCloseTo(
      CAMERA_MIN_VIEW_HALF_HEIGHT_WU * 4 ** CAMERA_VIEW_RADIUS_EXPONENT,
      9,
    );
    expect(quadrupled / viewHalfHeightFor(quadrupled)).toBeGreaterThan(
      SPAWN_RADIUS_WU / viewHalfHeightFor(SPAWN_RADIUS_WU),
    );
  });

  const rows = cameraTable();

  it('reads the five masses of game-design/controls-and-scope.md §7', () => {
    expect(rows.map((row) => printedNumber(row[0]).value)).toEqual([
      DEFAULT_BALANCE.growth.CELL_STARTING_MASS,
      80,
      312,
      900,
      DEFAULT_BALANCE.growth.CELL_MAX_MASS,
    ]);
  });

  it.each(rows.map((row) => [printedNumber(row[0]).value, row] as const))('mass %s as §7 prints it', (mass, row) => {
    const radius = radiusForMass(mass, DEFAULT_BALANCE.growth);
    expectAsPrinted(radius, row[1], 'radius');
    expectAsPrinted(viewHalfHeightFor(radius), row[2], 'view half-height');
    expectAsPrinted(viewHalfHeightFor(radius) / radius, row[3], 'radii ahead');
    expectAsPrinted(ownCellPx(radius, 800) * radius, row[4], 'own cell at 800 px tall');
    expectAsPrinted(ownCellPx(radius, VIEWPORT.height) * radius, row[5], 'own cell at 1080 px tall');
  });
});

describe('zoom, extent and projections', () => {
  const state = { x: 100, y: 50, viewHalfHeightWu: 540 };

  it('derives px per wu from the vertical extent', () => {
    expect(zoomFor(state, VIEWPORT)).toBe(1);
    expect(zoomFor({ ...state, viewHalfHeightWu: 300 }, VIEWPORT)).toBeCloseTo(1.8, 9);
  });

  it('spans the viewport aspect around the centre', () => {
    expect(cameraExtent(state, VIEWPORT)).toEqual({ minX: -860, maxX: 1060, minY: -490, maxY: 590 });
    expect(cameraExtent(state, { width: 100, height: 0 }).maxX).toBe(640);
  });

  it('caps the drawn world width at the interest aspect, so a 3:1 canvas sees 2.4 × its visible height (#408)', () => {
    const ultrawide = { width: 3000, height: 1000 };
    const extent = cameraExtent(state, ultrawide);
    expect(extent.maxX - extent.minX).toBeCloseTo(INTEREST_VIEW_ASPECT_RATIO * (extent.maxY - extent.minY), 9);
    expect((extent.minX + extent.maxX) * HALF).toBeCloseTo(state.x, 9);
    expect(drawnWidthPx(ultrawide)).toBeCloseTo(INTEREST_VIEW_ASPECT_RATIO * ultrawide.height, 9);
    expect(zoomFor(state, ultrawide)).toBe((ultrawide.height * HALF) / state.viewHalfHeightWu);
    expect(drawnWidthPx(VIEWPORT)).toBe(VIEWPORT.width);
    expect(drawnWidthPx({ width: 3440, height: 1440 })).toBe(3440);
  });

  it('maps world to screen and back', () => {
    const screen = worldToScreen(state, VIEWPORT, 100, 50);
    expect(screen).toEqual({ x: 960, y: 540 });
    expect(screenToWorld(state, VIEWPORT, 960 + 10, 540 - 10)).toEqual({ x: 110, y: 40 });
  });

  it('answers the same point as an offset from the middle of the view, free of the centre', () => {
    expect(screenOffsetToWorld(state, VIEWPORT, 960 + 10, 540 - 10)).toEqual({ x: 10, y: -10 });
    const moved = { ...state, x: 5000, y: -5000 };
    expect(screenOffsetToWorld(moved, VIEWPORT, 960 + 10, 540 - 10)).toEqual({ x: 10, y: -10 });
  });

  it('answers the view centre, never NaN, for a viewport with no height (a hidden tab, a 0 × 0 canvas mid-resize)', () => {
    const empty = { width: 0, height: 0 };
    expect(hasViewportHeight(empty)).toBe(false);
    expect(hasViewportHeight({ width: 0, height: 1 })).toBe(true);
    expect(screenOffsetToWorld(state, empty, 0, 0)).toEqual({ x: 0, y: 0 });
    expect(screenToWorld(state, empty, 0, 0)).toEqual({ x: 100, y: 50 });
    expect(screenToWorld(state, { width: 100, height: 0 }, 70, 0)).toEqual({ x: 100, y: 50 });
    expect(cameraExtent(state, empty)).toEqual({ minX: -440, maxX: 640, minY: -490, maxY: 590 });
  });

  it('keeps a disc that reaches into the extent by any amount, and no disc that stops short of it', () => {
    const extent = cameraExtent(state, VIEWPORT);
    expect(isDiscVisibleInExtent(extent, extent.maxX + 10, 50, 10)).toBe(true);
    expect(isDiscVisibleInExtent(extent, extent.maxX + 10.5, 50, 10)).toBe(false);
    expect(isDiscVisibleInExtent(extent, 50, extent.minY - 99, 100)).toBe(true);
  });
});
