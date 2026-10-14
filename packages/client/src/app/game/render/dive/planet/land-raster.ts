// The land mask a coastline bake starts from (docs/rendering/opening-dive.md §4): polygons filled by the nonzero rule
// at texel centres. It is a path context, so `d3.geoPath` draws the world's rings into it after cutting them at the
// antimeridian, and the region's rings are drawn into it directly. The mockup filled a Canvas 2D path and read the
// pixels back (land where the coverage was at least half); this is the same mask with no canvas, so it bakes in a
// test too.

import { HALF } from '../../geometry';

/** One polygon edge in texels, with its winding: +1 going down the rows, −1 going up. */
interface Edge {
  readonly topY: number;
  readonly bottomY: number;
  /** x where the edge meets `topY`, and how far x moves per texel down. */
  readonly topX: number;
  readonly slope: number;
  readonly winding: number;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

/** A row's crossing: where an edge cuts the row's centre line, and its winding. */
interface Crossing {
  readonly x: number;
  readonly winding: number;
}

/** Rows filled between yields, so a bake runs in slices. */
const ROWS_PER_SLICE = 64;
export const LAND = 1;

/** The first texel row or column whose centre lies at or past `edge`. */
function firstCentreAtOrPast(edge: number): number {
  return Math.ceil(edge - HALF);
}

export class LandRaster {
  private readonly edges: Edge[] = [];
  private ringStart: Point | null = null;
  private last: Point | null = null;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  moveTo(x: number, y: number): void {
    this.closePath();
    this.ringStart = { x, y };
    this.last = this.ringStart;
  }

  lineTo(x: number, y: number): void {
    const point = { x, y };
    if (this.last !== null) this.addEdge(this.last, point);
    this.last = point;
  }

  closePath(): void {
    if (this.ringStart !== null && this.last !== null) this.addEdge(this.last, this.ringStart);
    this.ringStart = null;
    this.last = null;
  }

  /** A point feature: no area, so no land. `d3.geoPath` draws one as a circle. */
  arc(): void {
    return undefined;
  }

  beginPath(): void {
    this.closePath();
  }

  private addEdge(start: Point, end: Point): void {
    if (start.y === end.y) return;
    const [top, bottom] = start.y < end.y ? [start, end] : [end, start];
    this.edges.push({
      topY: top.y,
      bottomY: bottom.y,
      topX: top.x,
      slope: (bottom.x - top.x) / (bottom.y - top.y),
      winding: start.y < end.y ? 1 : -1,
    });
  }

  /** The edges by the first row whose centre each one crosses. */
  private edgesByFirstRow(): Edge[][] {
    const rows: Edge[][] = Array.from({ length: this.height }, () => []);
    for (const edge of this.edges) {
      const first = Math.max(0, firstCentreAtOrPast(edge.topY));
      if (first < this.height && first < firstCentreAtOrPast(edge.bottomY)) rows[first]!.push(edge);
    }
    return rows;
  }

  /** The texels whose centre the path's nonzero fill covers are `LAND`, the rest 0; it yields every few rows. */
  *fill(): Generator<void, Uint8Array> {
    this.closePath();
    const mask = new Uint8Array(this.width * this.height);
    const startingAt = this.edgesByFirstRow();
    let active: Edge[] = [];
    for (let row = 0; row < this.height; row += 1) {
      const centreY = row + HALF;
      active = active.filter((edge) => edge.bottomY > centreY).concat(startingAt[row]!);
      const crossings = active
        .map((edge): Crossing => ({ x: edge.topX + (centreY - edge.topY) * edge.slope, winding: edge.winding }))
        .sort((left, right) => left.x - right.x);
      this.fillRow(mask, row, crossings);
      if (row % ROWS_PER_SLICE === ROWS_PER_SLICE - 1) yield;
    }
    return mask;
  }

  private fillRow(mask: Uint8Array, row: number, crossings: readonly Crossing[]): void {
    let winding = 0;
    for (let index = 0; index < crossings.length - 1; index += 1) {
      winding += crossings[index]!.winding;
      if (winding === 0) continue;
      const first = Math.max(0, firstCentreAtOrPast(crossings[index]!.x));
      const end = Math.min(this.width, firstCentreAtOrPast(crossings[index + 1]!.x));
      mask.fill(LAND, row * this.width + first, row * this.width + Math.max(first, end));
    }
  }
}
