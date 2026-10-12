// What the giant cells are called and the one real-life line each teaches (docs/ecology/giants.md §3.5.11 and
// §3.5.12), beside the forms' own lines (`form-facts.ts`). The name is what the threat label, the hold-Tab panel and the
// death overlay say (`cellDisplayName`); the line is what the giant popup adds when the player swallows one
// (docs/ui/overlays.md §3.8). Each line differs from its form's, so a player who has seen the form popup learns
// something new, and each was checked against the sources §3.5.12 names. Pure data, keyed by species, so a species
// added to `GIANT_SPECIES` fails to compile here until it is named and given a line.

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
