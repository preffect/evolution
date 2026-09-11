// A radial bake sampled per pixel (docs/RENDERING.md §6): the alpha of a `RadialBakeSpec`'s stops
// by each pixel's distance from the centre over the half-diagonal, written as premultiplied RGBA8
// bytes. The one radial sampler in the app: a canvas radial gradient cannot be read back in tests,
// and Pixi's `FillGradient` floods its gradient with the last stop before painting, which turned a
// clear-centred bake (the vignette) into the edge alpha everywhere (#229).

import { lerp } from '@evolution/shared';
import { ALPHA, BLUE, CHANNEL_MAX, GREEN, RED, RGBA_CHANNELS, hexToRgb, type Rgb } from '../colour';
import { HALF } from '../geometry';
import { RADIAL_BAKE_SHAPE, type RadialBakeSpec, type RadialStop } from '../render-textures';

const CLEAR = 0;

/** The stops' alpha at `offset` (0 at the centre, 1 at the half-diagonal): linear between stops, held flat past the ends. */
export function sampleRadialAlpha(stops: readonly RadialStop[], offset: number): number {
  const first = stops[0];
  if (first === undefined) return CLEAR;
  if (offset <= first.offset) return first.alpha;
  let previous = first;
  for (const stop of stops.slice(1)) {
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
