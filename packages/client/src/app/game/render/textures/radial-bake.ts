// A radial bake sampled per pixel (docs/rendering/budget.md §6): the alpha of a `RadialBakeSpec`'s stops
// by each pixel's distance from the centre over the half-diagonal, written as premultiplied RGBA8
// bytes. The one radial sampler in the app: a canvas radial gradient cannot be read back in tests,
// and Pixi's `FillGradient` floods its gradient with the last stop before painting, which turned a
// clear-centred bake (the vignette) into the edge alpha everywhere (#229).
// The spec shape and the app's two specs live here, beside the sampler that reads them, so nothing
// imports them back out of the bundle (`render-textures.ts` is the importer, never the source).

import { lerp } from '@evolution/shared';
import { ALPHA, BLUE, CHANNEL_MAX, GREEN, RED, RGBA_CHANNELS, hexToRgb, type Rgb } from '../colour';
import {
  GLOW_TEXTURE_PX,
  VIGNETTE,
  VIGNETTE_ALPHA,
  VIGNETTE_RADIUS_FRACTION,
  VIGNETTE_TEXTURE_PX,
  WHITE,
} from '../constants';
import { HALF } from '../geometry';

/** One stop of a `RadialBakeSpec`: not `texture-bake.ts`'s `RadialStop`, which colours each stop of a canvas gradient. */
export interface RadialBakeStop {
  /** 0 at the centre, 1 at the half-diagonal of the bake. */
  readonly offset: number;
  readonly alpha: number;
}

export const RADIAL_BAKE_SHAPE = { disc: 'disc', square: 'square' } as const;
export type RadialBakeShape = (typeof RADIAL_BAKE_SHAPE)[keyof typeof RADIAL_BAKE_SHAPE];

/** One radial-gradient bake: a `sizePx` square (or the disc inscribed in it) shaded from its centre. */
export interface RadialBakeSpec {
  readonly sizePx: number;
  readonly shape: RadialBakeShape;
  readonly colour: string;
  readonly stops: readonly RadialBakeStop[];
}

const CLEAR = 0;
const OPAQUE = 1;
/** Where the inscribed disc's rim sits on the centre-to-corner scale. */
const DISC_RIM_OFFSET = 1 / Math.SQRT2;

/** The soft disc: opaque at the centre, clear at the rim (the glow atlas's `disc`, ASSET-GENERATION §1.5). */
export const SOFT_DISC_BAKE: RadialBakeSpec = {
  sizePx: GLOW_TEXTURE_PX,
  shape: RADIAL_BAKE_SHAPE.disc,
  colour: WHITE,
  stops: [
    { offset: 0, alpha: OPAQUE },
    { offset: DISC_RIM_OFFSET, alpha: CLEAR },
  ],
};

/** The vignette: transparent to `VIGNETTE_RADIUS_FRACTION` of the half-diagonal, then to the vignette colour. */
export const VIGNETTE_BAKE: RadialBakeSpec = {
  sizePx: VIGNETTE_TEXTURE_PX,
  shape: RADIAL_BAKE_SHAPE.square,
  colour: VIGNETTE,
  stops: [
    { offset: 0, alpha: CLEAR },
    { offset: VIGNETTE_RADIUS_FRACTION, alpha: CLEAR },
    { offset: 1, alpha: VIGNETTE_ALPHA },
  ],
};

/**
 * The stops' alpha at `offset` (0 at the centre, 1 at the half-diagonal): linear between stops, held flat past the
 * ends. Indexed rather than `for … of stops.slice(1)`: this runs once per pixel — 262 144 times for the vignette —
 * and the slice was one array allocated per pixel (ticket #442).
 */
export function sampleRadialAlpha(stops: readonly RadialBakeStop[], offset: number): number {
  const first = stops[0];
  if (first === undefined) return CLEAR;
  if (offset <= first.offset) return first.alpha;
  let previous = first;
  for (let index = 1; index < stops.length; index += 1) {
    const stop = stops[index]!;
    if (offset <= stop.offset) {
      return lerp(previous.alpha, stop.alpha, (offset - previous.offset) / (stop.offset - previous.offset));
    }
    previous = stop;
  }
  return previous.alpha;
}

/** One premultiplied pixel: the colour scaled by its alpha, as the sprite blend expects. */
function writePremultipliedPixel(bytes: Uint8Array, offset: number, rgb: Rgb, alpha: number): void {
  const alphaByte = Math.round(alpha * CHANNEL_MAX);
  bytes[offset + RED] = Math.round(rgb[RED] * alphaByte);
  bytes[offset + GREEN] = Math.round(rgb[GREEN] * alphaByte);
  bytes[offset + BLUE] = Math.round(rgb[BLUE] * alphaByte);
  bytes[offset + ALPHA] = alphaByte;
}

/** The byte offset of pixel (`x`, `y`) in a `sizePx` square. */
export function radialPixelOffset(sizePx: number, x: number, y: number): number {
  return (y * sizePx + x) * RGBA_CHANNELS;
}

/**
 * The `sizePx × sizePx` premultiplied RGBA8 bytes of a radial bake: `spec.colour` at the stops' alpha by
 * each pixel centre's distance from the middle over the half-diagonal; a disc is clear outside its rim.
 */
export function bakeRadialBytes(spec: RadialBakeSpec): Uint8Array {
  const { sizePx } = spec;
  const rgb = hexToRgb(spec.colour);
  const centre = sizePx * HALF;
  const halfDiagonal = centre * Math.SQRT2;
  const bytes = new Uint8Array(sizePx * sizePx * RGBA_CHANNELS);
  for (let y = 0; y < sizePx; y += 1) {
    for (let x = 0; x < sizePx; x += 1) {
      const distance = Math.hypot(x + HALF - centre, y + HALF - centre);
      const isOutsideDisc = spec.shape === RADIAL_BAKE_SHAPE.disc && distance > centre;
      const alpha = isOutsideDisc ? CLEAR : sampleRadialAlpha(spec.stops, distance / halfDiagonal);
      writePremultipliedPixel(bytes, radialPixelOffset(sizePx, x, y), rgb, alpha);
    }
  }
  return bytes;
}
