// Pixel bakes for the shore's tiles (docs/rendering/opening-dive.md §4, ticket #801, the mockup's `imgBakeG`): a
// function of the pixel writes its colour into a buffer a few rows at a time, so a tile bakes across frames, and the
// buffer goes onto a canvas in one `putImageData`. Plus the colour helpers the bakes share.

import { SHORE_PIXEL_ROWS_PER_SLICE } from '../../constants/dive-shore-tiles';
import { ALPHA, BLUE, CHANNEL_MAX, GREEN, RED, RGBA_CHANNELS, hexToRgb } from '../../colour';
import { HALF } from '../../geometry';
import type { ShoreCanvas, ShoreCanvasFactory } from './shore-canvas';
import { lerp } from './shore-noise';

/** A colour in 0–255 channels. */
export type Rgb255 = readonly [number, number, number];

/** One pixel's colour as a bake writes it: 0–255 channels, alpha 0–255. */
export interface PixelColour {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

/** Writes the colour of the tile's pixel `(x, y)` into `out`; `out.alpha` starts opaque. */
export type PixelShader = (x: number, y: number, out: PixelColour) => void;

/** A hex colour in 0–255 channels. */
export function rgb255(hex: string): Rgb255 {
  const [red, green, blue] = hexToRgb(hex);
  return [red * CHANNEL_MAX, green * CHANNEL_MAX, blue * CHANNEL_MAX];
}

/** Three hex colours as a ramp's low, middle and high (`ramp3`'s A, B, C). */
export function rampOf(hexes: readonly [string, string, string]): readonly [Rgb255, Rgb255, Rgb255] {
  return [rgb255(hexes[0]), rgb255(hexes[1]), rgb255(hexes[2])];
}

/** Two linear ramps meeting at the middle: `low` at 0, `middle` at ½, `high` at 1 (`ramp3`). */
export function ramp3(low: Rgb255, middle: Rgb255, high: Rgb255, value: number): Rgb255 {
  if (value < HALF) {
    const fraction = value / HALF;
    return [
      lerp(low[RED], middle[RED], fraction),
      lerp(low[GREEN], middle[GREEN], fraction),
      lerp(low[BLUE], middle[BLUE], fraction),
    ];
  }
  const fraction = (value - HALF) / HALF;
  return [
    lerp(middle[RED], high[RED], fraction),
    lerp(middle[GREEN], high[GREEN], fraction),
    lerp(middle[BLUE], high[BLUE], fraction),
  ];
}

/** Sets `out` to `rgb` at `alpha` (0–255). */
export function setColour(out: PixelColour, rgb: Rgb255, alpha: number = CHANNEL_MAX): void {
  out.red = rgb[RED];
  out.green = rgb[GREEN];
  out.blue = rgb[BLUE];
  out.alpha = alpha;
}

export function clampUnit(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** A `width × height` tile from a pixel shader, yielding every few rows; the canvas once every row is written. */
export function* pixelBake(
  factory: ShoreCanvasFactory,
  size: { readonly width: number; readonly height: number },
  shade: PixelShader,
): Generator<void, ShoreCanvas> {
  const canvas = factory.create(size.width, size.height);
  const pixels = canvas.context.createImageData(size.width, size.height);
  const colour: PixelColour = { red: 0, green: 0, blue: 0, alpha: CHANNEL_MAX };
  for (let y = 0; y < size.height; y += 1) {
    for (let x = 0; x < size.width; x += 1) {
      colour.alpha = CHANNEL_MAX;
      shade(x, y, colour);
      const offset = (y * size.width + x) * RGBA_CHANNELS;
      pixels.data[offset + RED] = colour.red;
      pixels.data[offset + GREEN] = colour.green;
      pixels.data[offset + BLUE] = colour.blue;
      pixels.data[offset + ALPHA] = colour.alpha;
    }
    if (y % SHORE_PIXEL_ROWS_PER_SLICE === SHORE_PIXEL_ROWS_PER_SLICE - 1) yield;
  }
  canvas.context.putImageData(pixels, 0, 0);
  return canvas;
}

/** A square tile from a pixel shader. */
export function squarePixelBake(
  factory: ShoreCanvasFactory,
  sizePx: number,
  shade: PixelShader,
): Generator<void, ShoreCanvas> {
  return pixelBake(factory, { width: sizePx, height: sizePx }, shade);
}

/** Draws `draw` at `(x, y)` and at each of its 8 wrapped copies that reach the tile, so shapes cross the seams. */
export function wrapDraw(
  sizePx: number,
  place: { readonly x: number; readonly y: number; readonly reach: number },
  draw: (x: number, y: number) => void,
): void {
  for (let column = -1; column <= 1; column += 1) {
    for (let row = -1; row <= 1; row += 1) {
      const x = place.x + column * sizePx;
      const y = place.y + row * sizePx;
      const isOff = x + place.reach < 0 || x - place.reach > sizePx || y + place.reach < 0 || y - place.reach > sizePx;
      if (!isOff) draw(x, y);
    }
  }
}
