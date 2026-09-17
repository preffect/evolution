// The paint a subject glyph is made of (docs/visual-style/ui-type.md §7.2): the ramps it may be lit with, the line
// weights it may draw at, the alphas its soft passes use, and how far from the centre it may reach. No layer stack
// lives here — those are `subject-glyph-motifs.ts`'s — so a table that only needs a colour takes only a colour.

import type { GlyphRamp } from '../svg-glyph';
import {
  BACTERIUM_PLAIN,
  BG_DEEP,
  BG_FIELD,
  BUBBLE_RIM,
  DANGER,
  DEPTH_NEAR,
  DNA_DEEP,
  DNA_STRAND,
  DNA_STRAND_LIGHT,
  FOOD_MOTE,
  FOOD_MOTE_EDGE,
  FOOD_MOTE_RIM,
  LEVEL_GOLD,
  LIGHT_ACCENT,
  LIPID_BASE,
  LIPID_CENTRE,
  LIPID_LIGHT,
  MAGNET_BASE,
  MAGNET_DARK,
  MAGNET_LIGHT,
  PLAYER_PALETTE_TABLE,
  PROTO_FILM,
  SILICA_DARK,
  STAGE_SCRATCH,
  VENT_CRUST,
  VENT_CRUST_RIM,
  WALL_GLASS,
  WALL_GLASS_INNER,
  WALL_GLASS_OUTER,
  WHITE,
  ZONE_GEL,
  ZONE_SHALLOWS,
  ZONE_VENT,
} from './colours';

/** The seat a player cell is drawn in: the first of `PLAYER_PALETTE_TABLE`, so the page always shows seat one. */
const FIRST_SEAT_INDEX = 0;
export const GLYPH_PLAYER_SEAT = PLAYER_PALETTE_TABLE[FIRST_SEAT_INDEX]!;

/**
 * The ramps the subjects are lit with, beside `GLYPH_RAMP`'s organelle families: the food kinds, the DNA strand, the
 * three tinted zones, the dish glass and vent crust, the level gold and the attractor's steel. Every stop is a
 * `colours.ts` name, so a subject glyph paints nothing the dish does not.
 */
export const SUBJECT_RAMP = {
  algae: { light: FOOD_MOTE_RIM, base: FOOD_MOTE, dark: FOOD_MOTE_EDGE },
  lipid: { light: LIPID_LIGHT, base: LIPID_BASE, dark: LIPID_CENTRE },
  dna: { light: DNA_STRAND_LIGHT, base: DNA_STRAND, dark: DNA_DEEP },
  accent: { light: BUBBLE_RIM, base: LIGHT_ACCENT, dark: SILICA_DARK },
  rod: { light: BUBBLE_RIM, base: BACTERIUM_PLAIN, dark: PROTO_FILM },
  shallows: { light: FOOD_MOTE_RIM, base: ZONE_SHALLOWS, dark: SILICA_DARK },
  vent: { light: LIPID_LIGHT, base: ZONE_VENT, dark: VENT_CRUST_RIM },
  gel: { light: DNA_STRAND_LIGHT, base: ZONE_GEL, dark: DNA_DEEP },
  broth: { light: LIGHT_ACCENT, base: BG_FIELD, dark: SILICA_DARK },
  glass: { light: WALL_GLASS_OUTER, base: WALL_GLASS_INNER, dark: WALL_GLASS },
  crust: { light: VENT_CRUST_RIM, base: VENT_CRUST, dark: BG_DEEP },
  gold: { light: WHITE, base: LEVEL_GOLD, dark: VENT_CRUST_RIM },
  danger: { light: LIPID_LIGHT, base: DANGER, dark: DNA_DEEP },
  /** The stage's own inert greys: no organelle owns them, so a wild cell reads as nobody's colour. */
  wild: { light: DEPTH_NEAR, base: STAGE_SCRATCH, dark: BG_DEEP },
  steel: { light: MAGNET_LIGHT, base: MAGNET_BASE, dark: MAGNET_DARK },
  player: { light: GLYPH_PLAYER_SEAT.rim, base: GLYPH_PLAYER_SEAT.base, dark: SILICA_DARK },
} as const satisfies Readonly<Record<string, GlyphRamp>>;

/**
 * How far from the centre a subject glyph may draw: the frame's radius 47 divided by `GLYPH_LIST_ZOOM` 1.2, so a
 * drawing that fits at the card LOD still fits once the list LOD enlarges it. `subject-glyphs.spec.ts` pins it.
 */
export const GLYPH_MEDALLION_REACH = 39;
/** The line weights a subject glyph draws at: one scale, so no drawing invents a width. */
export const SUBJECT_STROKE = { hair: 1.2, fine: 1.8, rim: 2.2, mark: 3.2, heavy: 4.6 } as const;
/** The alphas the recurring soft passes use: a halo, a wash behind a body, a rim scatter, a faint field. */
export const SUBJECT_ALPHA = { halo: 0.45, wash: 0.3, scatter: 0.7, faint: 0.18 } as const;
