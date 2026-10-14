// Flat point lists (docs/rendering/opening-dive.md §4, ticket #801): the coast's rings and every polyline drawn along
// them are `[x, y, x, y, …]` in metres, as the mockup kept them, so a ring of thousands of points is one array.

/** Coordinates a point takes in a flat list. */
export const POINT_STRIDE = 2;

/** A flat list of points: `[x, y, x, y, …]`. */
export type FlatPoints = readonly number[] | Float64Array;

export function pointCount(points: FlatPoints): number {
  return points.length / POINT_STRIDE;
}

export function pointX(points: FlatPoints, index: number): number {
  return points[index * POINT_STRIDE] ?? 0;
}

export function pointY(points: FlatPoints, index: number): number {
  return points[index * POINT_STRIDE + 1] ?? 0;
}

/** An upright box in metres. */
export interface MetreBox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** The box round a segment. */
export function segmentBox(start: readonly [number, number], end: readonly [number, number]): MetreBox {
  return {
    minX: Math.min(start[0], end[0]),
    minY: Math.min(start[1], end[1]),
    maxX: Math.max(start[0], end[0]),
    maxY: Math.max(start[1], end[1]),
  };
}

/** Whether `box` lies wholly outside `window` grown by `margin` on every side. */
export function isOutside(box: MetreBox, window: MetreBox, margin: number): boolean {
  const isOffX = box.maxX < window.minX - margin || box.minX > window.maxX + margin;
  return isOffX || box.maxY < window.minY - margin || box.minY > window.maxY + margin;
}

/** The box round two boxes. */
export function unionBox(first: MetreBox, second: MetreBox): MetreBox {
  return {
    minX: Math.min(first.minX, second.minX),
    minY: Math.min(first.minY, second.minY),
    maxX: Math.max(first.maxX, second.maxX),
    maxY: Math.max(first.maxY, second.maxY),
  };
}
