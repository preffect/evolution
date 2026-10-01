// The coastline bakes' signed distance (docs/rendering/opening-dive.md §4, the mockup's `bakeSdf`): from a land mask,
// each texel's distance to the coast in texels, + on land, by Felzenszwalb and Huttenlocher's squared distance
// transform. Texels near the coast take their exact distance to its segments instead, so the shader's zero line is
// the vector coast and not the mask's staircase. Encoded in three byte channels (`DIVE_SDF_LEVELS_PER_TEXEL`). It
// yields as it goes, so the dive bakes it in slices beside its frames.

import {
  DIVE_SDF_EXACT_BAND_TEXELS,
  DIVE_SDF_LEVELS_PER_TEXEL,
  DIVE_SDF_TEXEL_CENTRE_OFFSET,
  DIVE_SDF_TRUSTED_TEXELS,
  DIVE_SDF_ZERO_LEVEL,
} from '../../constants';
import { HALF } from '../../geometry';
import { LAND } from './land-raster';

/** One coast segment in texels. */
export interface CoastSegment {
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
}

/** Far enough to stand for "no feature yet" in a squared distance. */
const UNREACHED = 1e20;
const CHANNEL_MAX = 255;
const RGBA_CHANNELS = 4;
/** Columns, rows, segments or texels worked between yields. */
const COLUMNS_PER_SLICE = 64;
const SEGMENTS_PER_SLICE = 256;
const TEXELS_PER_SLICE = 262144;

/** Scratch rows for one pass of the 1-D transform, sized for the longer side. */
interface TransformRows {
  readonly input: Float64Array;
  readonly output: Float64Array;
  readonly parabolas: Int32Array;
  readonly boundaries: Float64Array;
}

/** Where the parabola from `vertex` and the one from `query` cross. */
function crossingOf(input: Float64Array, query: number, vertex: number): number {
  return ((input[query]! + query * query - (input[vertex]! + vertex * vertex)) * HALF) / (query - vertex);
}

/** The squared distance transform of one row or column of `length` (Felzenszwalb & Huttenlocher, `edt1d`). */
export function distanceTransform1d(rows: TransformRows, length: number): void {
  const { input, output, parabolas, boundaries } = rows;
  let count = 0;
  parabolas[0] = 0;
  boundaries[0] = -UNREACHED;
  boundaries[1] = UNREACHED;
  for (let query = 1; query < length; query += 1) {
    let crossing = crossingOf(input, query, parabolas[count]!);
    while (crossing <= boundaries[count]!) {
      count -= 1;
      crossing = crossingOf(input, query, parabolas[count]!);
    }
    count += 1;
    parabolas[count] = query;
    boundaries[count] = crossing;
    boundaries[count + 1] = UNREACHED;
  }
  count = 0;
  for (let query = 0; query < length; query += 1) {
    while (boundaries[count + 1]! < query) count += 1;
    const offset = query - parabolas[count]!;
    output[query] = offset * offset + input[parabolas[count]!]!;
  }
}

/** The 2-D squared distance transform in place: columns, then rows (`edt2d`; the mockup's shore uses it too). */
export function* distanceTransform2d(grid: Float64Array, width: number, height: number): Generator<void> {
  const longer = Math.max(width, height);
  const rows: TransformRows = {
    input: new Float64Array(longer),
    output: new Float64Array(longer),
    parabolas: new Int32Array(longer),
    boundaries: new Float64Array(longer + 1),
  };
  for (let column = 0; column < width; column += 1) {
    for (let row = 0; row < height; row += 1) rows.input[row] = grid[row * width + column]!;
    distanceTransform1d(rows, height);
    for (let row = 0; row < height; row += 1) grid[row * width + column] = rows.output[row]!;
    if (column % COLUMNS_PER_SLICE === COLUMNS_PER_SLICE - 1) yield;
  }
  for (let row = 0; row < height; row += 1) {
    const start = row * width;
    rows.input.set(grid.subarray(start, start + width));
    distanceTransform1d(rows, width);
    grid.set(rows.output.subarray(0, width), start);
    if (row % COLUMNS_PER_SLICE === COLUMNS_PER_SLICE - 1) yield;
  }
}

/** Lowers each texel within the exact band of `segment` to its distance from it. */
function markNearSegment(near: Float32Array, segment: CoastSegment, width: number, height: number): void {
  const { fromX, fromY, toX, toY } = segment;
  const band = DIVE_SDF_EXACT_BAND_TEXELS;
  const columnFirst = Math.max(0, Math.floor(Math.min(fromX, toX) - band));
  const columnLast = Math.min(width - 1, Math.ceil(Math.max(fromX, toX) + band));
  const rowFirst = Math.max(0, Math.floor(Math.min(fromY, toY) - band));
  const rowLast = Math.min(height - 1, Math.ceil(Math.max(fromY, toY) + band));
  const alongX = toX - fromX;
  const alongY = toY - fromY;
  const lengthSquared = alongX * alongX + alongY * alongY || Number.EPSILON;
  for (let row = rowFirst; row <= rowLast; row += 1) {
    for (let column = columnFirst; column <= columnLast; column += 1) {
      const offsetX = column + HALF - fromX;
      const offsetY = row + HALF - fromY;
      const along = Math.min(1, Math.max(0, (offsetX * alongX + offsetY * alongY) / lengthSquared));
      const texel = row * width + column;
      near[texel] = Math.min(near[texel]!, Math.hypot(offsetX - along * alongX, offsetY - along * alongY));
    }
  }
}

/** Each texel's exact distance to the nearest segment, for texels within the exact band of one; far ones stay far. */
function* nearSegmentDistances(
  segments: readonly CoastSegment[],
  width: number,
  height: number,
): Generator<void, Float32Array> {
  const near = new Float32Array(width * height).fill(UNREACHED);
  for (let index = 0; index < segments.length; index += 1) {
    markNearSegment(near, segments[index]!, width, height);
    if (index % SEGMENTS_PER_SLICE === SEGMENTS_PER_SLICE - 1) yield;
  }
  return near;
}

function channelLevel(signedTexels: number, levelsPerTexel: number): number {
  return Math.min(CHANNEL_MAX, Math.max(0, Math.round(DIVE_SDF_ZERO_LEVEL + signedTexels * levelsPerTexel)));
}

/** One texel's signed distance in its three channels and an opaque alpha. */
export function encodeSignedDistance(out: Uint8Array, texel: number, signedTexels: number): void {
  out.set(
    [
      channelLevel(signedTexels, DIVE_SDF_LEVELS_PER_TEXEL.red),
      channelLevel(signedTexels, DIVE_SDF_LEVELS_PER_TEXEL.green),
      channelLevel(signedTexels, DIVE_SDF_LEVELS_PER_TEXEL.blue),
      CHANNEL_MAX,
    ],
    texel * RGBA_CHANNELS,
  );
}

/** The signed distance read back from the channels, as the shader reads it: the finest one that has not saturated. */
export function decodeSignedDistance(data: Uint8Array, texel: number): number {
  const base = texel * RGBA_CHANNELS;
  const [redLevel = 0, greenLevel = 0, blueLevel = 0] = data.subarray(base, base + RGBA_CHANNELS);
  const red = (redLevel - DIVE_SDF_ZERO_LEVEL) / DIVE_SDF_LEVELS_PER_TEXEL.red;
  const green = (greenLevel - DIVE_SDF_ZERO_LEVEL) / DIVE_SDF_LEVELS_PER_TEXEL.green;
  const blue = (blueLevel - DIVE_SDF_ZERO_LEVEL) / DIVE_SDF_LEVELS_PER_TEXEL.blue;
  if (Math.abs(red) < DIVE_SDF_TRUSTED_TEXELS.red) return red;
  return Math.abs(green) < DIVE_SDF_TRUSTED_TEXELS.green ? green : blue;
}

/** The squared distance from every texel to the nearest texel of the other kind, as two grids. */
function* rasterDistances(
  mask: Uint8Array,
  width: number,
  height: number,
): Generator<void, [Float64Array, Float64Array]> {
  const toSea = new Float64Array(mask.length);
  const toLand = new Float64Array(mask.length);
  for (let texel = 0; texel < mask.length; texel += 1) {
    const isLand = mask[texel] === LAND;
    toSea[texel] = isLand ? UNREACHED : 0;
    toLand[texel] = isLand ? 0 : UNREACHED;
    if (texel % TEXELS_PER_SLICE === TEXELS_PER_SLICE - 1) yield;
  }
  yield* distanceTransform2d(toSea, width, height);
  yield* distanceTransform2d(toLand, width, height);
  return [toSea, toLand];
}

/** The bake: `width × height` RGBA texels of signed distance from `mask` (`LAND` on land) and its coast segments. */
export function* bakeSignedDistance(
  mask: Uint8Array,
  width: number,
  height: number,
  segments: readonly CoastSegment[],
): Generator<void, Uint8Array> {
  const [toSea, toLand] = yield* rasterDistances(mask, width, height);
  const near = yield* nearSegmentDistances(segments, width, height);
  const out = new Uint8Array(mask.length * RGBA_CHANNELS);
  for (let texel = 0; texel < mask.length; texel += 1) {
    const isLand = toSea[texel]! > 0;
    const raster = isLand
      ? Math.sqrt(toSea[texel]!) - DIVE_SDF_TEXEL_CENTRE_OFFSET
      : -(Math.sqrt(toLand[texel]!) - DIVE_SDF_TEXEL_CENTRE_OFFSET);
    const exact = near[texel]!;
    encodeSignedDistance(out, texel, exact < DIVE_SDF_EXACT_BAND_TEXELS ? (isLand ? exact : -exact) : raster);
    if (texel % TEXELS_PER_SLICE === TEXELS_PER_SLICE - 1) yield;
  }
  return out;
}
