// The form each giant cell is (docs/ecology/giants.md §3.5.11): the form trait its build ends in, so the giant is drawn
// as that form and the encyclopedia's medallion for it is that form's glyph (docs/ui/encyclopedia.md §11.3). Read from
// the shipped builds: a build is structure, which no balance patch can change (`debug_set_balance` writes numbers only,
// giants.md §3.5.14), so the shipped one is the live one.

import {
  CELL_STAGE,
  GIANT_BUILDS_BY_SPECIES,
  STAGE_GATE_TRAITS,
  type GiantSpecies,
  type TraitId,
} from '@evolution/shared';

/** The form trait `species`' build ends in: the one of the specialised stage's gates it owns. */
export function giantFormTraitId(species: GiantSpecies): TraitId {
  const formTraitIds = STAGE_GATE_TRAITS[CELL_STAGE.specialised];
  const form = GIANT_BUILDS_BY_SPECIES[species].find((owned) => formTraitIds.includes(owned.traitId));
  if (form === undefined) throw new Error(`The giant ${species} owns no form`);
  return form.traitId;
}
