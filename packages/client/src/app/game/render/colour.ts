// Hex ↔ RGB ↔ HSL and Pixi tint conversions shared by the palette, the atlases and the layers.

import { HUE_SECTOR } from './constants/colours';
import { DEGREES_PER_TURN, HALF } from './geometry';

export type Rgb = readonly [number, number, number];

const HEX_RADIX = 16;
const HEX_CHANNEL_DIGITS = 2;
/** 8-bit channel range and the RGB(A) channel indices, shared with the palette bake. */
export const CHANNEL_MAX = 255;
export const RED = 0;
export const GREEN = 1;
export const BLUE = 2;
export const ALPHA = 3;
const HUE_SECTORS = 6;
/** The HSL sector formula folds the hue into pairs of sectors. */
const HUE_SECTOR_PAIR = 2;
const SRGB_LINEAR_THRESHOLD = 0.04045;
const SRGB_LINEAR_DIVISOR = 12.92;
const SRGB_OFFSET = 0.055;
const SRGB_SCALE = 1.055;
const SRGB_GAMMA = 2.4;
const LINEAR_SRGB_THRESHOLD = 0.0031308;

export interface Hsl {
  readonly hue: number;
  readonly saturation: number;
  readonly lightness: number;
}

export function hexToRgb(hex: string): Rgb {
  const digits = hex.replace('#', '');
  const channel = (index: number) =>
    parseInt(digits.slice(index * HEX_CHANNEL_DIGITS, (index + 1) * HEX_CHANNEL_DIGITS), HEX_RADIX) / CHANNEL_MAX;
  return [channel(RED), channel(GREEN), channel(BLUE)];
}

export function rgbToHex(rgb: Rgb): string {
  const digits = rgb.map((value) =>
    Math.max(0, Math.min(CHANNEL_MAX, Math.round(value * CHANNEL_MAX)))
      .toString(HEX_RADIX)
      .padStart(HEX_CHANNEL_DIGITS, '0'),
  );
  return `#${digits.join('')}`;
}

/** The 0xRRGGBB number Pixi tints take. */
export function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), HEX_RADIX);
}

/** A CSS `rgba()` string for canvas baking. */
export function hexWithAlpha(hex: string, alpha: number): string {
  const [red, green, blue] = hexToRgb(hex).map((value) => Math.round(value * CHANNEL_MAX));
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function srgbToLinear(channel: number): number {
  return channel <= SRGB_LINEAR_THRESHOLD
    ? channel / SRGB_LINEAR_DIVISOR
    : Math.pow((channel + SRGB_OFFSET) / SRGB_SCALE, SRGB_GAMMA);
}

export function linearToSrgb(channel: number): number {
  const clamped = Math.max(0, Math.min(1, channel));
  return clamped <= LINEAR_SRGB_THRESHOLD
    ? clamped * SRGB_LINEAR_DIVISOR
    : SRGB_SCALE * Math.pow(clamped, 1 / SRGB_GAMMA) - SRGB_OFFSET;
}

function hueSector([red, green, blue]: Rgb, max: number, range: number): number {
  if (max === red) return ((green - blue) / range) % HUE_SECTORS;
  if (max === green) return (blue - red) / range + HUE_SECTOR_PAIR;
  return (red - green) / range + HUE_SECTOR_PAIR * HUE_SECTOR_PAIR;
}

export function rgbToHsl(rgb: Rgb): Hsl {
  const max = Math.max(...rgb);
  const min = Math.min(...rgb);
  const lightness = (max + min) * HALF;
  const range = max - min;
  if (range === 0) return { hue: 0, saturation: 0, lightness };
  const saturation = range / (1 - Math.abs(HUE_SECTOR_PAIR * lightness - 1));
  const sector = hueSector(rgb, max, range);
  const hue = (sector * (DEGREES_PER_TURN / HUE_SECTORS) + DEGREES_PER_TURN) % DEGREES_PER_TURN;
  return { hue, saturation, lightness };
}

/** The chroma and its secondary placed by hue sector; the wrap past the last sector lands on red again. */
function sectorRgb(sector: number, chroma: number, second: number): Rgb {
  switch (Math.floor(sector)) {
    case HUE_SECTOR.yellowToGreen:
      return [second, chroma, 0];
    case HUE_SECTOR.greenToCyan:
      return [0, chroma, second];
    case HUE_SECTOR.cyanToBlue:
      return [0, second, chroma];
    case HUE_SECTOR.blueToMagenta:
      return [second, 0, chroma];
    case HUE_SECTOR.magentaToRed:
      return [chroma, 0, second];
    default:
      return [chroma, second, 0];
  }
}

/** Any hue: negative or past a turn, it is folded into [0, 360) first. */
export function hslToRgb({ hue, saturation, lightness }: Hsl): Rgb {
  const chroma = (1 - Math.abs(HUE_SECTOR_PAIR * lightness - 1)) * saturation;
  const foldedHue = ((hue % DEGREES_PER_TURN) + DEGREES_PER_TURN) % DEGREES_PER_TURN;
  const sector = foldedHue / (DEGREES_PER_TURN / HUE_SECTORS);
  const second = chroma * (1 - Math.abs((sector % HUE_SECTOR_PAIR) - 1));
  const match = lightness - chroma * HALF;
  const [red, green, blue] = sectorRgb(sector, chroma, second);
  return [red + match, green + match, blue + match];
}
