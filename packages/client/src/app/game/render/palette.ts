// The eight player palettes and their derived shades (docs/VISUAL-STYLE.md §2; sheet 01's HSL rule),
// packed into the 8 × 8 palette texture the cell shader reads (docs/RENDERING.md §2.3).

import { PLAYER_PALETTE_COUNT } from '@evolution/shared';
import { ALPHA, BLUE, CHANNEL_MAX, GREEN, RED, hexToRgb, hslToRgb, rgbToHex, rgbToHsl } from './colour';
import { CHLORO_BASE, PALETTE_SHADE_COUNT, PLAYER_PALETTE_TABLE, type PlayerPaletteRow } from './constants';

/**
 * Sheet 01's rule, read back from its six drawn ramps: every derived shade keeps the hue and scales
 * the lightness (edge 42 %, cyto light 55 %, cyto dark 22 %) and the saturation of the base; the
 * nucleus dark scales the nucleus colour the same way.
 */
const EDGE_LIGHTNESS_SCALE = 0.42;
const EDGE_SATURATION_SCALE = 0.9;
const CYTO_LIGHT_LIGHTNESS_SCALE = 0.55;
const CYTO_LIGHT_SATURATION_SCALE = 0.8;
const CYTO_DARK_LIGHTNESS_SCALE = 0.22;
const CYTO_DARK_SATURATION_SCALE = 0.55;
const NUCLEUS_DARK_LIGHTNESS_SCALE = 0.45;
const NUCLEUS_DARK_SATURATION_SCALE = 0.9;
/** A palette added after sheet 01 derives its rim and nucleus from the base hue (VISUAL-STYLE §2). */
const NEW_RIM_SATURATION = 1.0;
const NEW_RIM_LIGHTNESS = 0.85;
const NEW_NUCLEUS_SATURATION = 0.85;
const NEW_NUCLEUS_LIGHTNESS = 0.7;
const RGBA_CHANNELS = 4;

export interface PlayerPalette extends PlayerPaletteRow {
  readonly edge: string;
  readonly cytoLight: string;
  readonly cytoDark: string;
  readonly nucleusDark: string;
}

function scaledShade(hex: string, lightnessScale: number, saturationScale: number): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  return rgbToHex(
    hslToRgb({ hue: hsl.hue, saturation: hsl.saturation * saturationScale, lightness: hsl.lightness * lightnessScale }),
  );
}

/** Sheet 01's derivation of the four unlisted shades. */
export function derivePalette(row: PlayerPaletteRow): PlayerPalette {
  return {
    ...row,
    edge: scaledShade(row.base, EDGE_LIGHTNESS_SCALE, EDGE_SATURATION_SCALE),
    cytoLight: scaledShade(row.base, CYTO_LIGHT_LIGHTNESS_SCALE, CYTO_LIGHT_SATURATION_SCALE),
    cytoDark: scaledShade(row.base, CYTO_DARK_LIGHTNESS_SCALE, CYTO_DARK_SATURATION_SCALE),
    nucleusDark: scaledShade(row.nucleus, NUCLEUS_DARK_LIGHTNESS_SCALE, NUCLEUS_DARK_SATURATION_SCALE),
  };
}

/** The rim and nucleus a new palette takes from its base hue (VISUAL-STYLE §2). */
export function newPaletteAccents(base: string): { rim: string; nucleus: string } {
  const { hue } = rgbToHsl(hexToRgb(base));
  return {
    rim: rgbToHex(hslToRgb({ hue, saturation: NEW_RIM_SATURATION, lightness: NEW_RIM_LIGHTNESS })),
    nucleus: rgbToHex(hslToRgb({ hue, saturation: NEW_NUCLEUS_SATURATION, lightness: NEW_NUCLEUS_LIGHTNESS })),
  };
}

export const PLAYER_PALETTES: readonly PlayerPalette[] = PLAYER_PALETTE_TABLE.map(derivePalette);

export function paletteFor(avatarIndex: number): PlayerPalette {
  return PLAYER_PALETTES[((avatarIndex % PLAYER_PALETTE_COUNT) + PLAYER_PALETTE_COUNT) % PLAYER_PALETTE_COUNT]!;
}

/** The shades of one palette in `PALETTE_SHADE` column order. */
export function paletteShades(palette: PlayerPalette): readonly string[] {
  return [
    palette.base,
    palette.rim,
    palette.nucleus,
    palette.edge,
    palette.cytoLight,
    palette.cytoDark,
    palette.nucleusDark,
    CHLORO_BASE,
  ];
}

/** RGBA bytes of the palette texture: one row per palette, one column per shade; the shader samples it. */
export function bakePaletteTextureBytes(): Uint8Array {
  const bytes = new Uint8Array(PLAYER_PALETTE_COUNT * PALETTE_SHADE_COUNT * RGBA_CHANNELS);
  PLAYER_PALETTES.forEach((palette, row) => {
    paletteShades(palette).forEach((hex, column) => {
      const [red, green, blue] = hexToRgb(hex);
      const offset = (row * PALETTE_SHADE_COUNT + column) * RGBA_CHANNELS;
      bytes[offset + RED] = Math.round(red * CHANNEL_MAX);
      bytes[offset + GREEN] = Math.round(green * CHANNEL_MAX);
      bytes[offset + BLUE] = Math.round(blue * CHANNEL_MAX);
      bytes[offset + ALPHA] = CHANNEL_MAX;
    });
  });
  return bytes;
}
