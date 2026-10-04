// The coast in metres for one view (docs/rendering/opening-dive.md §4, ticket #801, the mockup's `buildCoast` and
// `coastDist`): the Salish rings refined below the data's resolution, warped at the rocky point and cut to the view
// and its margin, plus a spatial hash of the refined segments for signed distance queries (+ land, − sea). The
// shore's snapshots build one per level of detail, and the planet's forest test one per step of zoom
// (`shore-forest-test.ts`).

import {
  SHORE_COAST_GRID_CELLS,
  SHORE_COAST_MIN_CELL_M,
  SHORE_COAST_REFINE,
  SHORE_COAST_TINY_SQUARED,
  SHORE_COAST_WINDOW,
  SHORE_COAST_SEGMENT_FIELD,
  SHORE_RING_MIN_COORDINATES,
} from '../../constants/dive-shore-coast';
import { clipToEdge, refineSegment, warpRockyPoint, type CoastWindow } from './shore-coast-refine';
import type { LandRing, LandRings } from './shore-coast-rings';
import { mixHash } from './shore-noise';
import { POINT_STRIDE, isOutside, pointCount, pointX, pointY, segmentBox } from './shore-points';

/** The view a coast is built for: half its extent in metres round the focus, and its scale. */
export interface CoastView {
  readonly halfWidthM: number;
  readonly halfHeightM: number;
  readonly pixelsPerMetre: number;
}

/** A built ring: flat `[x, y, …]` cut to the window, and which side of it is land. */
export interface CoastRing {
  readonly points: readonly number[];
  readonly landSign: number;
}

/** Floats per refined segment in `segments`: its start, its end and its land sign. */
export const COAST_SEGMENT_FLOATS = 5;

/** One refined segment of the coast. */
export interface CoastSegment {
  readonly start: readonly [number, number];
  readonly end: readonly [number, number];
  readonly landSign: number;
}

/** Segment `index` of a flat segment list. */
export function segmentAt(segments: readonly number[], index: number): CoastSegment {
  const base = index * COAST_SEGMENT_FLOATS;
  const field = (offset: number): number => segments[base + offset] ?? 0;
  return {
    start: [field(SHORE_COAST_SEGMENT_FIELD.startX), field(SHORE_COAST_SEGMENT_FIELD.startY)],
    end: [field(SHORE_COAST_SEGMENT_FIELD.endX), field(SHORE_COAST_SEGMENT_FIELD.endY)],
    landSign: field(SHORE_COAST_SEGMENT_FIELD.landSign) || 1,
  };
}

export class ShoreCoast {
  /** The rings of the last build, cut to its window. */
  rings: readonly CoastRing[] = [];
  /** The refined segments near the window, `COAST_SEGMENT_FLOATS` each. */
  segments: readonly number[] = [];
  /** The margin past the view the last build covered. */
  marginM = 0;
  private grid: (number[] | undefined)[] = [];
  private gridCellM = 1;
  private gridMinX = 0;
  private gridMinY = 0;
  private gridColumns = 0;
  private gridRows = 0;

  constructor(private readonly land: LandRings) {}

  /** Builds the coast for `view` (`buildCoast`). */
  build(view: CoastView): void {
    const marginM = Math.max(view.halfWidthM * SHORE_COAST_WINDOW.marginHalfViews, SHORE_COAST_WINDOW.minMarginM);
    const window: CoastWindow = {
      minX: -view.halfWidthM,
      minY: -view.halfHeightM,
      maxX: view.halfWidthM,
      maxY: view.halfHeightM,
      marginM,
      halfWidthM: view.halfWidthM,
      pixelsPerMetre: view.pixelsPerMetre,
    };
    const rings: CoastRing[] = [];
    const segments: number[] = [];
    for (const ring of this.land.rings) {
      if (this.isRingOutside(ring, window)) continue;
      const built = this.buildRing(ring, window, segments);
      if (built !== null) rings.push(built);
    }
    this.rings = rings;
    this.segments = segments;
    this.marginM = marginM;
    this.buildGrid(window);
  }

  private isRingOutside(ring: LandRing, window: CoastWindow): boolean {
    const pad = Math.max(ring.maxX - ring.minX, ring.maxY - ring.minY) * SHORE_COAST_WINDOW.ringPadShare;
    return isOutside(ring, window, window.marginM + pad);
  }

  /** The refined, warped ring, its near segments pushed to `segments`, cut to the window; `null` when nothing is left. */
  private buildRing(ring: LandRing, window: CoastWindow, segments: number[]): CoastRing | null {
    const { points: refined, isBoxEdge } = refineRing(ring, window);
    for (let point = 0; point < pointCount(refined); point += 1) {
      refined[point * POINT_STRIDE + 1] = warpRockyPoint(pointX(refined, point), pointY(refined, point));
    }
    const landSign = ring.winding * this.land.landSide;
    pushNearSegments(refined, isBoxEdge, { window, landSign }, segments);
    const margin = window.marginM;
    let clipped = clipToEdge(refined, { axis: 0, value: window.minX - margin, isKeepingBelow: false });
    clipped = clipToEdge(clipped, { axis: 0, value: window.maxX + margin, isKeepingBelow: true });
    clipped = clipToEdge(clipped, { axis: 1, value: window.minY - margin, isKeepingBelow: false });
    clipped = clipToEdge(clipped, { axis: 1, value: window.maxY + margin, isKeepingBelow: true });
    return clipped.length >= SHORE_RING_MIN_COORDINATES ? { points: clipped, landSign } : null;
  }

  private buildGrid(window: CoastWindow): void {
    const minX = window.minX - window.marginM;
    const maxX = window.maxX + window.marginM;
    const minY = window.minY - window.marginM;
    const maxY = window.maxY + window.marginM;
    const cell = Math.max((maxX - minX) / SHORE_COAST_GRID_CELLS, SHORE_COAST_MIN_CELL_M);
    const columns = Math.ceil((maxX - minX) / cell) + 1;
    const rows = Math.ceil((maxY - minY) / cell) + 1;
    const grid: (number[] | undefined)[] = new Array<number[] | undefined>(columns * rows);
    const segments = this.segments;
    for (let segment = 0; segment < segments.length / COAST_SEGMENT_FLOATS; segment += 1) {
      const { start, end } = segmentAt(segments, segment);
      const box = segmentBox(start, end);
      const column0 = clampIndex(Math.floor((box.minX - minX) / cell), columns);
      const column1 = clampIndex(Math.floor((box.maxX - minX) / cell), columns);
      const row0 = clampIndex(Math.floor((box.minY - minY) / cell), rows);
      const row1 = clampIndex(Math.floor((box.maxY - minY) / cell), rows);
      for (let column = column0; column <= column1; column += 1) {
        for (let row = row0; row <= row1; row += 1) (grid[row * columns + column] ??= []).push(segment);
      }
    }
    this.grid = grid;
    this.gridCellM = cell;
    this.gridMinX = minX;
    this.gridMinY = minY;
    this.gridColumns = columns;
    this.gridRows = rows;
  }

  /** The signed distance to the coast (+ land, − sea) within `maxM`; `NaN` when no coast is that close (`coastDist`). */
  distance(x: number, y: number, maxM: number): number {
    const cell = this.gridCellM;
    const column0 = Math.max(0, Math.floor((x - maxM - this.gridMinX) / cell));
    const column1 = Math.min(this.gridColumns - 1, Math.floor((x + maxM - this.gridMinX) / cell));
    const row0 = Math.max(0, Math.floor((y - maxM - this.gridMinY) / cell));
    const row1 = Math.min(this.gridRows - 1, Math.floor((y + maxM - this.gridMinY) / cell));
    const best = { squared: maxM * maxM, sign: Number.NaN };
    for (let row = row0; row <= row1; row += 1) {
      for (let column = column0; column <= column1; column += 1) {
        for (const segment of this.grid[row * this.gridColumns + column] ?? []) this.measure(segment, { x, y }, best);
      }
    }
    return Number.isNaN(best.sign) ? Number.NaN : best.sign * Math.sqrt(best.squared);
  }

  private measure(
    index: number,
    point: { readonly x: number; readonly y: number },
    best: { squared: number; sign: number },
  ): void {
    const segment = segmentAt(this.segments, index);
    const [startX, startY] = segment.start;
    const deltaX = segment.end[0] - startX;
    const deltaY = segment.end[1] - startY;
    const lengthSquared = deltaX * deltaX + deltaY * deltaY || SHORE_COAST_TINY_SQUARED;
    const along = Math.min(1, Math.max(0, ((point.x - startX) * deltaX + (point.y - startY) * deltaY) / lengthSquared));
    const offX = point.x - startX - along * deltaX;
    const offY = point.y - startY - along * deltaY;
    const squared = offX * offX + offY * offY;
    if (squared >= best.squared) return;
    best.squared = squared;
    best.sign = Math.sign(deltaX * (point.y - startY) - deltaY * (point.x - startX)) * segment.landSign || 1;
  }
}

function clampIndex(index: number, count: number): number {
  return Math.min(count - 1, Math.max(0, index));
}

/** One of the data's segments refined onto `points` (a box edge is kept straight). */
function refineDataSegment(ring: LandRing, window: CoastWindow, index: number, points: number[]): void {
  const source = ring.points;
  const next = (index + 1) % ring.count;
  const [startX, startY] = [pointX(source, index), pointY(source, index)];
  const [endX, endY] = [pointX(source, next), pointY(source, next)];
  if (ring.isBoxEdge[index] === 1) {
    points.push(endX, endY);
    return;
  }
  const hash = mixHash(ring.id * SHORE_COAST_REFINE.ringMultiplier + index * SHORE_COAST_REFINE.segmentMultiplier);
  const isFocusStart = startX === 0 && startY === 0;
  const isFocusEnd = endX === 0 && endY === 0;
  refineSegment(window, { startX, startY, endX, endY, hash, depth: 0, isFocusStart, isFocusEnd }, points);
}

/** The ring refined segment by segment, and each refined point's box-edge flag. */
function refineRing(ring: LandRing, window: CoastWindow): { points: number[]; isBoxEdge: number[] } {
  const points: number[] = [pointX(ring.points, 0), pointY(ring.points, 0)];
  const isBoxEdge: number[] = [];
  for (let index = 0; index < ring.count; index += 1) {
    const before = pointCount(points);
    refineDataSegment(ring, window, index, points);
    const edge = ring.isBoxEdge[index] ?? 0;
    for (let point = before; point < pointCount(points); point += 1) isBoxEdge.push(edge);
  }
  points.length -= POINT_STRIDE; // the loop closed back on the first point
  return { points, isBoxEdge };
}

/** The refined segments within the window's margin, not on the data's box, for the distance queries. */
function pushNearSegments(
  points: readonly number[],
  isBoxEdge: readonly number[],
  context: { readonly window: CoastWindow; readonly landSign: number },
  segments: number[],
): void {
  const { window, landSign } = context;
  const count = pointCount(points);
  for (let index = 0; index < count; index += 1) {
    if (isBoxEdge[index] === 1) continue;
    const next = (index + 1) % count;
    const start: [number, number] = [pointX(points, index), pointY(points, index)];
    const end: [number, number] = [pointX(points, next), pointY(points, next)];
    if (!isOutside(segmentBox(start, end), window, window.marginM)) segments.push(...start, ...end, landSign);
  }
}
