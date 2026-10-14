// Outlines baked into signed distance textures (docs/rendering/opening-dive.md §4, ticket #802): the focal rock's, and
// the coast round the rock and the stipe. Each closed polygon is filled by the nonzero rule into a mask over a box in
// metres (`LandRaster`), and the mask becomes a signed distance in texels, exact near the outline (+ inside), packed
// as the planet's coastline bakes are (`bakeSignedDistance`), so the kelp's shaders clip to the rock and to the sea
// with an antialiased edge at any zoom. The rock's outline is the shore's own `rockPath`, sampled.

import { LandRaster } from '../planet/land-raster';
import { bakeSignedDistance, type CoastSegment } from '../planet/signed-distance';
import { rockPath, type BlobPathContext, type BlobPlace } from '../shore/shore-shapes';
import { pointCount, pointX, pointY, type FlatPoints } from '../shore/shore-points';

/** A box in metres: `[minX, minY, maxX, maxY]`. */
export type KelpBox = readonly [number, number, number, number];

/** A baked signed distance: its RGBA texels, its size, the box it covers and the metres a texel spans. */
export interface KelpDistanceBake {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly box: KelpBox;
  readonly metresPerTexel: number;
}

/** Records a smooth closed path as a polygon: each quadratic curve sampled `perCurve` times. */
class OutlineRecorder implements BlobPathContext {
  readonly points: number[] = [];
  private cursorX = 0;
  private cursorY = 0;

  constructor(private readonly perCurve: number) {}

  beginPath(): void {
    this.points.length = 0;
  }

  moveTo(x: number, y: number): void {
    this.points.push(x, y);
    this.cursorX = x;
    this.cursorY = y;
  }

  quadraticCurveTo(controlX: number, controlY: number, x: number, y: number): void {
    for (let step = 1; step <= this.perCurve; step += 1) {
      const along = step / this.perCurve;
      const start = (1 - along) * (1 - along);
      const control = DOUBLE * along * (1 - along);
      const end = along * along;
      this.points.push(
        start * this.cursorX + control * controlX + end * x,
        start * this.cursorY + control * controlY + end * y,
      );
    }
    this.cursorX = x;
    this.cursorY = y;
  }

  closePath(): void {
    return undefined;
  }
}

const DOUBLE = 2;

/** A stone's outline (`rockPath`) as a closed polygon, flat `[x, y, …]` in metres. */
export function rockOutline(place: BlobPlace, perCurve: number): number[] {
  const recorder = new OutlineRecorder(perCurve);
  rockPath(recorder, place);
  return recorder.points;
}

/** Twice the signed area of a closed polygon: its winding's sign in y-down metres. */
export function signedArea(points: FlatPoints): number {
  let area = 0;
  const count = pointCount(points);
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    area += pointX(points, index) * pointY(points, next) - pointX(points, next) * pointY(points, index);
  }
  return area;
}

/** The nonzero winding number of the polygons round `(x, y)`. */
export function windingAt(polygons: readonly FlatPoints[], x: number, y: number): number {
  let winding = 0;
  for (const points of polygons) {
    const count = pointCount(points);
    for (let index = 0; index < count; index += 1) {
      const next = (index + 1) % count;
      const [fromX, fromY] = [pointX(points, index), pointY(points, index)];
      const [toX, toY] = [pointX(points, next), pointY(points, next)];
      if (fromY <= y === toY <= y) continue;
      const crossX = fromX + ((y - fromY) / (toY - fromY)) * (toX - fromX);
      if (crossX > x) winding += toY > fromY ? 1 : -1;
    }
  }
  return winding;
}

/** The texel grid over `box` at `metresPerTexel`. */
function gridOf(box: KelpBox, metresPerTexel: number): { readonly width: number; readonly height: number } {
  return {
    width: Math.ceil((box[2] - box[0]) / metresPerTexel),
    height: Math.ceil((box[3] - box[1]) / metresPerTexel),
  };
}

/**
 * Bakes the polygons' signed distance over `box`, `metresPerTexel` a texel, a few rows or segments a step: the mask
 * by the nonzero rule (inside +), then the distance, exact near the outlines.
 */
export function* bakeOutlineDistance(
  polygons: readonly FlatPoints[],
  box: KelpBox,
  metresPerTexel: number,
): Generator<void, KelpDistanceBake> {
  const { width, height } = gridOf(box, metresPerTexel);
  const toTexels = (points: FlatPoints, index: number): readonly [number, number] => [
    (pointX(points, index) - box[0]) / metresPerTexel,
    (pointY(points, index) - box[1]) / metresPerTexel,
  ];
  const raster = new LandRaster(width, height);
  const segments: CoastSegment[] = [];
  for (const points of polygons) {
    const count = pointCount(points);
    for (let index = 0; index < count; index += 1) {
      const [x, y] = toTexels(points, index);
      if (index === 0) raster.moveTo(x, y);
      else raster.lineTo(x, y);
      const [toX, toY] = toTexels(points, (index + 1) % count);
      segments.push({ fromX: x, fromY: y, toX, toY });
    }
    raster.closePath();
  }
  const mask = yield* raster.fill();
  const data = yield* bakeSignedDistance(mask, width, height, segments);
  return { data, width, height, box, metresPerTexel };
}

/** The box round a place, `reachRadii` of its radius every way. */
export function boxRound(
  place: { readonly x: number; readonly y: number; readonly radius: number },
  reachRadii: number,
): KelpBox {
  const reach = place.radius * reachRadii;
  return [place.x - reach, place.y - reach, place.x + reach, place.y + reach];
}

/** A distance bake's box as the shader reads it: its corner and its size in metres. */
export function boxUniform(bake: KelpDistanceBake): readonly [number, number, number, number] {
  return [bake.box[0], bake.box[1], bake.width * bake.metresPerTexel, bake.height * bake.metresPerTexel];
}
