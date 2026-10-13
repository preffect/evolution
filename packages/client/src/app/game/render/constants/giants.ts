// The giant cells' art (docs/ecology/giants.md §3.5.11, docs/visual-style/cells-and-organelles.md §4.1): a palette per
// species and the detail each form gains at giant size. Sizes are fractions of the cell radius `r` unless the suffix
// says px; points marked "membrane radii" are in the heading frame (+x the heading) as fractions of the membrane's
// own distance in that direction, so they ride the outline's deformation the way the organelle slots do.

import { GIANT_SPECIES, GIANT_SPECIES_ORDER, type GiantSpecies } from '@evolution/shared';
import {
  CHLORO_BASE,
  CILIA,
  DIATOM_PLASTID_BASE,
  ENVELOPE,
  SILICA_BASE,
  SILICA_DARK,
  SILICA_LIGHT,
  VAC_BASE,
  VAC_RIM,
} from './colours';

/** The instance's `giantSpeciesId` (cell-instance.ts): 0 for every other cell, else 1 + the species' fixed order. */
export const NO_GIANT_SPECIES_ID = 0;
export const GIANT_SPECIES_ID = Object.fromEntries(
  GIANT_SPECIES_ORDER.map((species, index) => [species, index + 1]),
) as Readonly<Record<GiantSpecies, number>>;

// ---- the palettes: natural, low-saturation ramps a player palette never wears ----
/**
 * A giant's ramp, authored in full (the mockup's three stops), unlike a player's, which derives its cytoplasm from the
 * base. The body ramp runs `cytoLight` at the centre, `cytoDark` at mid-radius, `base` toward the rim, `rim` on it;
 * the edge and the nucleus dark derive from `base` and `nucleus` by sheet 01's rule. `chloroBase` is the colour a
 * chloroplast tints the membrane toward: the diatom's is the golden brown of its plastids.
 */
export interface GiantPaletteRow {
  readonly name: string;
  readonly base: string;
  readonly rim: string;
  readonly nucleus: string;
  readonly cytoLight: string;
  readonly cytoDark: string;
  readonly chloroBase: string;
}

/**
 * The mockup's three species ramps (ticket #821). The amoeba's and the paramecium's rims are the mockup's hue at about
 * a third of its saturation: its own `#cfc8ff` and `#b8f6e0` sat ΔE 2 and 3 from the Violet and Mint player rims, so a
 * giant's arms and fringe would have worn a player's colour; these sit 11.8 and 11.9 from them.
 */
export const GIANT_PALETTE_TABLE: Readonly<Record<GiantSpecies, GiantPaletteRow>> = {
  [GIANT_SPECIES.amoeba]: {
    name: 'Giant amoeba',
    base: '#77729a',
    rim: '#d4d2e5',
    nucleus: '#958dd4',
    cytoLight: '#3d3b5a',
    cytoDark: '#25263d',
    chloroBase: CHLORO_BASE,
  },
  [GIANT_SPECIES.paramecium]: {
    name: 'Paramecium',
    base: '#5f9a86',
    rim: '#cfe9e0',
    nucleus: '#a8dcc4',
    cytoLight: '#2b5048',
    cytoDark: '#1a3330',
    chloroBase: CHLORO_BASE,
  },
  [GIANT_SPECIES.diatom]: {
    name: 'Giant diatom',
    base: '#c9d4de',
    rim: '#e6ecf2',
    nucleus: '#aebccb',
    cytoLight: '#6f7f8e',
    cytoDark: '#3c4856',
    chloroBase: DIATOM_PLASTID_BASE,
  },
};
/** A giant's rim against every player rim, CIEDE2000: the player rims' own nearest pair (Coral–Rose) is 11. */
export const GIANT_RIM_MIN_DELTA_E = 11;

/** The shades of a giant's palette its encyclopedia medallion may paint with. */
export type GiantGlyphShade = keyof Pick<GiantPaletteRow, 'base' | 'rim' | 'nucleus' | 'cytoDark'>;

/**
 * A giant's medallion is its form's trait glyph in the giant's own palette (docs/ui/encyclopedia.md §11.3): each colour
 * the three form glyphs paint their body, fringe and nucleus in becomes the palette shade that plays the same part, so
 * the list matches the preview. The body's light, base and dark pool take the rim, base and dark cytoplasm; the
 * nucleus its nucleus. Every other colour (the outline, the glint, the amoeba's mitochondrion, the diatom's plastids
 * and pore beads) is no part of the species' colouring and stays. The table matches on the colour's value, so every
 * layer of a form glyph drawn in a listed colour is swapped, not only the body: `SILICA_DARK` also recolours the
 * amoeba's nucleus outline and the paramecium's oral groove, and a layer added later in one of these colours will be
 * swapped too.
 */
export const GIANT_GLYPH_SHADE_BY_COLOUR: Readonly<Record<string, GiantGlyphShade>> = {
  [VAC_RIM]: 'rim',
  [VAC_BASE]: 'base',
  [SILICA_LIGHT]: 'rim',
  [SILICA_BASE]: 'base',
  [SILICA_DARK]: 'cytoDark',
  [CILIA]: 'rim',
  [ENVELOPE]: 'nucleus',
};

// ---- the diatom's golden-brown plastids (real diatoms' fucoxanthin), in place of the green chloroplasts ----
/** The giant diatom shows this many plastids whatever its `chloroplast` tier: one bean is lost in a shell 150 wu across. */
export const GIANT_DIATOM_PLASTID_COUNT = 5;
/** Smaller than a chloroplast (0.17 r): discs scattered through the valve, the mockup's four to six. */
export const GIANT_DIATOM_PLASTID_RADIUS = 0.1;

// ---- the amoeba's food vacuoles: the mockup's two dark pools of swallowed prey, green-rimmed by what it ate ----
export const GIANT_AMOEBA_DIGESTIVE_VACUOLE_COUNT = 2;
/**
 * A pool in `DIGESTIVE_VACUOLE_BASE` (dense at the centre, thinning to the rim) ringed faintly in `FOOD_MOTE`, with a
 * few half-digested motes inside: the mockup's 0.09–0.17 r circles (0.6 × its nucleus) with their 35 % green stroke.
 */
export const GIANT_DIGESTIVE_VACUOLE = {
  radius: 0.14,
  fillAlpha: { inner: 0.9, outer: 0.7 },
  rimAlpha: 0.4,
  /** The motes inside, as (x, y, radius) shares of the vacuole's radius from its centre. */
  motes: [
    { x: -0.3, y: 0.2, radius: 0.18 },
    { x: 0.25, y: 0.3, radius: 0.13 },
    { x: 0.1, y: -0.3, radius: 0.15 },
  ],
  moteAlpha: 0.45,
  glintAlpha: 0.3,
} as const;

// ---- the diatom's rings of pores (Coscinodiscus' areolae), between the valve's ribs ----
/** A pore every this many radii round each of the valve's pore rows, so the rows read as rings of dots. */
export const GIANT_DIATOM_RING_PORE_SPACING_RADII = 0.055;
export const GIANT_DIATOM_RING_PORE_RADIUS_RADII = 0.014;
export const GIANT_DIATOM_RING_PORE_ALPHA = 0.42;

// ---- the paramecium's fringe: the mockup's fine fuzzy outline, in place of a player's 16 tufts ----
/**
 * A giant's `cilia` hairs (cell-shader-tells.ts `cilia`, 12 % r leaning, on the travelling wave): about one every 5 px
 * of outline at the giant's 110–200 px on screen, where a tier's 24 read as spokes. Fixed, never a px pitch, so no
 * hair jumps while the zoom eases.
 */
export const GIANT_CILIA_COUNT = 180;
/** The travelling waves round a giant's fringe (a player's `CILIA_WAVE_COUNT` 3): short metachronal ripples. */
export const GIANT_CILIA_WAVE_COUNT = 8;

// ---- the paramecium's oral groove: from the outline's notch back to the mouth at mid-body (the mockup's curve) ----
/** Where the groove leaves the notch (membrane radii, along the notch's own direction) and where the mouth sits. */
export const GIANT_ORAL_GROOVE_START_RADII = 0.86;
export const GIANT_ORAL_GROOVE_END = { x: 0.02, y: 0.3 } as const;
/** How far the groove's arc bows out from its chord, toward the ventral side (membrane radii). */
export const GIANT_ORAL_GROOVE_BOW_RADII = 0.08;
/**
 * A dark crease in `OUTLINE` (membrane radii wide, with a px floor) and, along its edge away from the light, the lit
 * far wall in the rim colour (px wide): a depression lit from the top-left, the mockup's pale curve.
 */
export const GIANT_ORAL_GROOVE_WIDTH_RADII = 0.04;
export const GIANT_ORAL_GROOVE_MIN_WIDTH_PX = 2;
export const GIANT_ORAL_GROOVE_ALPHA = 0.45;
export const GIANT_ORAL_GROOVE_LIP_WIDTH_PX = 2.5;
export const GIANT_ORAL_GROOVE_LIP_ALPHA = 0.75;
/** The share of the groove, from the notch, over which the furrow fades in. */
export const GIANT_ORAL_GROOVE_FADE_SHARE = 0.2;
/** The mouth (cytostome) at the groove's end: a dark pit with a pale rim. */
export const GIANT_MOUTH_RADIUS_RADII = 0.06;
export const GIANT_MOUTH_ALPHA = 0.75;

// ---- contractile vacuoles: the water pumps every freshwater giant has, filling slowly and emptying at once ----
/** Paramecium: two star-shaped pumps near either end on the dorsal side, emptying half a cycle apart. */
export const GIANT_PARAMECIUM_VACUOLES = [
  { x: 0.58, y: -0.24 },
  { x: -0.58, y: -0.24 },
] as const;
/** Amoeba: one round pump toward the rear. */
export const GIANT_AMOEBA_VACUOLE = { x: -0.5, y: 0.22 } as const;
export const GIANT_VACUOLE_RADIUS_RADII = 0.1;
/** One fill-and-empty cycle: it swells over the first share and empties over the rest. */
export const GIANT_VACUOLE_CYCLE_SECONDS = 4;
export const GIANT_VACUOLE_FILL_SHARE = 0.85;
/** The emptied pump shrinks to this share of its radius before it refills. */
export const GIANT_VACUOLE_EMPTY_SCALE = 0.3;
export const GIANT_VACUOLE_FILL_ALPHA = 0.4;
export const GIANT_VACUOLE_RIM_WIDTH_PX = 2;
export const GIANT_VACUOLE_RIM_ALPHA = 0.85;
/** The paramecium's collecting canals: spokes from the pump, full while it is empty, drained as it swells. */
export const GIANT_VACUOLE_CANALS = 6;
export const GIANT_VACUOLE_CANAL_REACH = 2.4;
export const GIANT_VACUOLE_CANAL_WIDTH_RADII = 0.35;
export const GIANT_VACUOLE_CANAL_ALPHA = 0.55;
