// What the giant cells are called, the one real-life line each teaches and how big the real organism is
// (docs/ecology/giants.md §3.5.11 and §3.5.12). The name is what the threat label, the hold-Tab panel, the death overlay
// and the encyclopedia say (`cellDisplayName`, docs/ui/encyclopedia.md §11.4); the line is what the giant popup adds
// when the player swallows one (docs/ui/overlays.md §3.8) and what the giant's encyclopedia entry leads its real-life
// note with, beside the real size. Each line differs from its form's (`hud/format/form-facts.ts`), so a player who has
// seen the form popup learns something new, and each line and size was checked against the sources §3.5.12 names. It
// lives in the neutral `game/giants/` because the HUD and the encyclopedia both read it, and the encyclopedia never
// imports `hud/`. Pure data, keyed by species, so a species added to `GIANT_SPECIES` fails to compile here until it is
// named, given a line and measured.

import { GIANT_SPECIES, type GiantSpecies } from '@evolution/shared';

/** A giant's name on screen, in sentence case; the label roles upper-case it where they draw capitals. */
export const GIANT_DISPLAY_NAME_BY_SPECIES: Readonly<Record<GiantSpecies, string>> = {
  [GIANT_SPECIES.amoeba]: 'Giant amoeba',
  [GIANT_SPECIES.paramecium]: 'Paramecium',
  [GIANT_SPECIES.diatom]: 'Giant diatom',
};

/** The giant popup's real-life line, in the coach pill's style (no full stop). */
export const GIANT_REAL_LIFE_LINES: Readonly<Record<GiantSpecies, string>> = {
  [GIANT_SPECIES.amoeba]: 'Real giant amoebae can grow almost a millimetre across',
  [GIANT_SPECIES.paramecium]: 'Real paramecia sweep food into a groove that works as a mouth',
  [GIANT_SPECIES.diatom]: 'Real diatoms make at least a fifth of Earth’s oxygen',
};

/**
 * The real organism's size in words, for the encyclopedia's real-life note: no digits, as encyclopedia copy never types
 * a number (docs/architecture/encyclopedia.md §12.6), and a thing the reader can picture beside it.
 */
export const GIANT_REAL_SIZES: Readonly<Record<GiantSpecies, string>> = {
  [GIANT_SPECIES.amoeba]: 'About half a millimetre long, hundreds of times longer than a bacterium',
  [GIANT_SPECIES.paramecium]: 'About a quarter of a millimetre long, like a grain of fine sand',
  [GIANT_SPECIES.diatom]: 'Up to half a millimetre across, as big as a grain of sand',
};
