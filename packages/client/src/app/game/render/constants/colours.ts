// Every colour the renderer and the HUD draw (docs/VISUAL-STYLE.md §2 and the sheet tables it
// links). One hex, one name; draw code never holds a literal. Derived shades are computed in
// render/palette.ts, never listed here.

import { DNA_TAG, type DnaTag } from '@evolution/shared';

// ---- field and dish (sheet 01 / sheet 02) ----
export const BG_DEEP = '#04070d';
export const BG_FIELD = '#0b1626';
/** The condenser colour; doubles as the UI accent. */
export const LIGHT_ACCENT = '#7fe7f5';
export const OUTSIDE_DISH = '#02040a';
export const STAGE_SCRATCH = '#2a3d58';
export const WALL_GLASS = '#182c46';
export const WALL_GLASS_INNER = '#2a4a70';
export const WALL_GLASS_OUTER = '#4a6a90';
/** The one black: the vignette, the wall's inner shadow, the chromatin wash. */
export const BLACK = '#000000';
export const VIGNETTE = BLACK;
export const WALL_INNER_SHADOW = BLACK;

// ---- zones (sheet 02) ----
export const ZONE_SHALLOWS = '#8dffb0';
export const ZONE_VENT = '#ff9a4d';
export const ZONE_GEL = '#b070ff';
export const VENT_PLUME = '#ffb15a';
export const VENT_CRUST = '#12080a';
export const VENT_CRUST_RIM = '#7a3d12';
export const VENT_SEAM_HOT = '#ffd39a';
/** The vent bubbles (sheet 02 `bubble`): rim, inner ring and the fill's rim tone. */
export const BUBBLE_RIM = '#dff4ff';
export const BUBBLE_INNER_RING = LIGHT_ACCENT;
export const BUBBLE_FILL_RIM = '#a6f4ff';
export const BUBBLE_FILL_MID = '#3d7fc4';

// ---- food (sheet 02, VISUAL-STYLE §2) ----
export const FOOD_MOTE = '#8dff6a';
export const FOOD_MOTE_EDGE = '#3f9a2c';
export const FOOD_MOTE_RIM = '#dcffb0';
export const LIPID_LIGHT = '#fff8d0';
export const LIPID_BASE = '#f2c94c';
export const LIPID_CENTRE = '#c88a2a';
export const LIPID_RIM = '#ffe7a3';
export const DNA_STRAND_LIGHT = '#f0b8ff';
export const DNA_STRAND = '#d36bff';
export const BACTERIUM_PLAIN = '#cfefff';
export const PROTO_FILM = '#8fd3e3';
export const PROTO_FILM_LIGHT = '#d8f6ff';
export const PROTO_GRANULE = '#cfefff';

// ---- organelles (sheet 01, sheet 04) ----
export const MITO_LIGHT = '#ffd39a';
export const MITO_BASE = '#ffb15a';
export const MITO_DARK = '#b85c16';
export const VAC_BASE = '#a8d8ff';
export const VAC_RIM = '#dff0ff';
export const CHLORO_LIGHT = '#b8ff9a';
export const CHLORO_BASE = '#63d64a';
export const CHLORO_DARK = '#1f7a2b';
export const TOXIN_BASE = '#a338e0';
export const TOXIN_RIM = '#f0b8ff';
export const TOXIN_GLOW = '#d05cff';
export const MAGNET_LIGHT = '#9fb0c4';
export const MAGNET_BASE = '#4a5866';
export const MAGNET_DARK = '#141a22';
/** The chromatin spots: a black wash over the baked nucleus body. */
export const CHROMATIN_WASH = BLACK;
export const NUCLEOID_STRAND = '#e4faff';
export const NUCLEOID_GLOW = '#7fe7f5';
export const RIBOSOME = '#a6f4ff';
export const CELL_WALL = '#4fb1c4';
export const CELL_WALL_LIGHT = '#bff2ff';
export const FLAGELLUM = '#a6f4ff';
export const ENVELOPE = '#dff8ff';
export const PORE = '#7fe7f5';
export const CYTOSKELETON = '#7fe7f5';
export const CILIA = '#a6f4ff';
export const SILICA_LIGHT = '#eef9ff';
export const SILICA_BASE = '#a9dcef';
export const SILICA_DARK = '#2f6f8c';
export const DIATOM_PLASTID_LIGHT = '#d7a441';
export const DIATOM_PLASTID_DARK = '#8a5e14';
export const EYESPOT = '#ff4d3a';
export const EYESPOT_RIM = '#ffb59e';
export const SILHOUETTE = '#22c1d6';
export const OUTLINE = '#020509';
/** The one white: glints, seat-mark cores, the self ring, the protocell film light. */
export const WHITE = '#ffffff';

// ---- effects and UI (sheet 03, VISUAL-STYLE §2) ----
export const DANGER = '#ff5470';
export const LEVEL_GOLD = '#ffe08a';
export const DNA = '#d36bff';
export const DNA_DEEP = '#6b2ea6';
export const PANEL_TOP = '#0e1f33';
export const PANEL_BOTTOM = '#060e1a';
export const PANEL_RIM = '#173250';
export const UI_ACCENT = LIGHT_ACCENT;
export const TEXT = '#dfeaf2';
export const TEXT_LABEL = '#8fb3c9';
export const TEXT_MUTED = '#7f93a8';
export const TIMER_TRACK = '#0b1a2c';
export const LEVEL_RING_TRACK = '#132238';
export const DEPTH_FAR_TINTS = ['#ffffff', '#c4f0ff', '#9fe8f5', '#7fb8ff'] as const;
export const DEPTH_NEAR = '#dff4ff';

/** Fragments show their tag in the helix rungs and wide halo (VISUAL-STYLE §2). */
export const DNA_TAG_COLOR: Readonly<Record<DnaTag, string>> = {
  [DNA_TAG.motile]: '#66ecff',
  [DNA_TAG.metabolic]: '#ffb15a',
  [DNA_TAG.photic]: '#b8ff9a',
  [DNA_TAG.predatory]: '#ff5470',
  [DNA_TAG.toxic]: '#d05cff',
  [DNA_TAG.sensory]: '#6a9bff',
  [DNA_TAG.armored]: '#e6ecf2',
};

export interface PlayerPaletteRow {
  readonly name: string;
  readonly base: string;
  readonly rim: string;
  readonly nucleus: string;
}

/** Seat order (VISUAL-STYLE §2): the first k seats are mutually far apart on the hue wheel. */
export const PLAYER_PALETTE_TABLE: readonly PlayerPaletteRow[] = [
  { name: 'Cyan', base: '#22c1d6', rim: '#a6f4ff', nucleus: '#6fdcef' },
  { name: 'Coral', base: '#ff6b5c', rim: '#ffd0c8', nucleus: '#ff9a8c' },
  { name: 'Lime', base: '#7ed321', rim: '#dcffb0', nucleus: '#b5ef62' },
  { name: 'Violet', base: '#7b5cf0', rim: '#d2c4ff', nucleus: '#a995ff' },
  { name: 'Amber', base: '#e0a12a', rim: '#ffe7a3', nucleus: '#f5c85c' },
  { name: 'Mint', base: '#24db98', rim: '#b2ffe3', nucleus: '#71f4c4' },
  { name: 'Magenta', base: '#d43fb0', rim: '#ffb3ec', nucleus: '#f07ad2' },
  { name: 'Rose', base: '#bc5768', rim: '#ffb2bf', nucleus: '#f47187' },
];

/** Separability acceptance (VISUAL-STYLE §2), CIEDE2000. */
export const PALETTE_PAIR_MIN_DELTA_E = 15;
export const NEW_PALETTE_MIN_DELTA_E = 15;
export const TAG_PAIR_MIN_DELTA_E = 15;
/** The palette added after sheet 01, held to the bar under dichromacy too. */
export const NEW_PALETTE_INDEX = 7;
/** Every rim against `BG_FIELD` (WCAG ratio); bases are held to 4.0. */
export const RIM_MIN_CONTRAST = 4.5;
export const BASE_MIN_CONTRAST = 4.0;

/** The six hue sectors of the HSL wheel, by the primaries each one runs between. */
export const HUE_SECTOR = {
  redToYellow: 0,
  yellowToGreen: 1,
  greenToCyan: 2,
  cyanToBlue: 3,
  blueToMagenta: 4,
  magentaToRed: 5,
} as const;
