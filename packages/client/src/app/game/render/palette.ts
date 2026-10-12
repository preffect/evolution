// The eight player palettes and their derived shades (docs/visual-style/principles-and-palette.md §2; sheet 01's HSL rule),
// then the three giant species' palettes (docs/ecology/giants.md §3.5.11), packed into the 11 × 8 palette texture the
// cell shader reads (docs/rendering/cells.md §2.3): a cell's row is its seat's palette, or its species' for a giant.

import {
  GIANT_SPECIES_ORDER,
  PLAYER_PALETTE_COUNT,
  wrapAvatarIndex,
  type CellView,
  type GiantSpecies,
} from '@evolution/shared';
import { ALPHA, BLUE, CHANNEL_MAX, GREEN, RED, RGBA_CHANNELS, hexToRgb, hslToRgb, rgbToHex, rgbToHsl } from './colour';
import {
  CHLORO_BASE,
  GIANT_PALETTE_TABLE,
  PALETTE_SHADE_COUNT,
  PLAYER_PALETTE_TABLE,
  type GiantPaletteRow,
  type PlayerPaletteRow,
} from './constants';

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
/** A palette added after sheet 01 derives its rim and nucleus from the base hue (visual-style/principles-and-palette.md §2). */
const NEW_RIM_SATURATION = 1.0;
const NEW_RIM_LIGHTNESS = 0.85;
const NEW_NUCLEUS_SATURATION = 0.85;
const NEW_NUCLEUS_LIGHTNESS = 0.7;

/** A palette texture row: a seat's or a giant species' shades. */
export interface CellPalette extends PlayerPaletteRow {
  readonly edge: string;
  readonly cytoLight: string;
  readonly cytoDark: string;
  readonly nucleusDark: string;
  /** What a chloroplast tints the membrane toward: `CHLORO_BASE` but on the giant diatom (its golden plastids). */
  readonly chloroBase: string;
}

function scaledShade(hex: string, lightnessScale: number, saturationScale: number): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  return rgbToHex(
    hslToRgb({ hue: hsl.hue, saturation: hsl.saturation * saturationScale, lightness: hsl.lightness * lightnessScale }),
  );
}

/** Sheet 01's derivation of the four unlisted shades. */
export function derivePalette(row: PlayerPaletteRow): CellPalette {
  return {
    ...row,
    edge: scaledShade(row.base, EDGE_LIGHTNESS_SCALE, EDGE_SATURATION_SCALE),
    cytoLight: scaledShade(row.base, CYTO_LIGHT_LIGHTNESS_SCALE, CYTO_LIGHT_SATURATION_SCALE),
    cytoDark: scaledShade(row.base, CYTO_DARK_LIGHTNESS_SCALE, CYTO_DARK_SATURATION_SCALE),
    nucleusDark: scaledShade(row.nucleus, NUCLEUS_DARK_LIGHTNESS_SCALE, NUCLEUS_DARK_SATURATION_SCALE),
    chloroBase: CHLORO_BASE,
  };
}

/** A giant's authored ramp: its cytoplasm stops are the mockup's, the edge and nucleus dark follow sheet 01's rule. */
export function deriveGiantPalette(row: GiantPaletteRow): CellPalette {
  return {
    ...derivePalette(row),
    cytoLight: row.cytoLight,
    cytoDark: row.cytoDark,
    chloroBase: row.chloroBase,
  };
}

/** The rim and nucleus a new palette takes from its base hue (visual-style/principles-and-palette.md §2). */
export function newPaletteAccents(base: string): { rim: string; nucleus: string } {
  const { hue } = rgbToHsl(hexToRgb(base));
  return {
    rim: rgbToHex(hslToRgb({ hue, saturation: NEW_RIM_SATURATION, lightness: NEW_RIM_LIGHTNESS })),
    nucleus: rgbToHex(hslToRgb({ hue, saturation: NEW_NUCLEUS_SATURATION, lightness: NEW_NUCLEUS_LIGHTNESS })),
  };
}

export const PLAYER_PALETTES: readonly CellPalette[] = PLAYER_PALETTE_TABLE.map(derivePalette);
/** The giants' palettes in `GIANT_SPECIES_ORDER`, the texture rows after the players'. */
export const GIANT_PALETTES: readonly CellPalette[] = GIANT_SPECIES_ORDER.map((species) =>
  deriveGiantPalette(GIANT_PALETTE_TABLE[species]),
);
/** Every row of the palette texture: the seats, then the giant species. */
export const PALETTE_ROWS: readonly CellPalette[] = [...PLAYER_PALETTES, ...GIANT_PALETTES];

export function paletteFor(avatarIndex: number): CellPalette {
  return PLAYER_PALETTES[wrapAvatarIndex(avatarIndex)]!;
}

/** The palette texture row of `species`. */
export function giantPaletteIndex(species: GiantSpecies): number {
  return PLAYER_PALETTE_COUNT + GIANT_SPECIES_ORDER.indexOf(species);
}

/** The row a cell is drawn with: its species' for a giant (it has no seat), else its seat's. */
export function cellPaletteIndex(view: Pick<CellView, 'avatarIndex' | 'giantSpecies'>): number {
  return view.giantSpecies === null ? wrapAvatarIndex(view.avatarIndex) : giantPaletteIndex(view.giantSpecies);
}

/** The palette a cell's organelle sprites take (the nucleus tint): the row `cellPaletteIndex` names. */
export function cellPaletteFor(view: Pick<CellView, 'avatarIndex' | 'giantSpecies'>): CellPalette {
  return PALETTE_ROWS[cellPaletteIndex(view)]!;
}

/** The shades of one palette in `PALETTE_SHADE` column order. */
export function paletteShades(palette: CellPalette): readonly string[] {
  return [
    palette.base,
    palette.rim,
    palette.nucleus,
    palette.edge,
    palette.cytoLight,
    palette.cytoDark,
    palette.nucleusDark,
    palette.chloroBase,
  ];
}

/** RGBA bytes of the palette texture: one row per palette (`PALETTE_ROWS`), one column per shade; the shader samples it. */
export function bakePaletteTextureBytes(): Uint8Array {
  const bytes = new Uint8Array(PALETTE_ROWS.length * PALETTE_SHADE_COUNT * RGBA_CHANNELS);
  PALETTE_ROWS.forEach((palette, row) => {
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
