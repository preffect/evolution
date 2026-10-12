// The giant cells' roles in the player's words (docs/ui/encyclopedia.md §11.4): the chip a giant's page wears beside its
// kind. The role is the species' own (`GIANT_ROLE_BY_SPECIES`, a fixed constant and never a balance leaf), so a page
// cannot call a giant something its rules do not make it.

import { GIANT_ROLE, GIANT_ROLE_BY_SPECIES, type GiantRole, type GiantSpecies } from '@evolution/shared';

export const GIANT_ROLE_LABEL: Readonly<Record<GiantRole, string>> = {
  [GIANT_ROLE.hunter]: 'Hunter',
  [GIANT_ROLE.grazer]: 'Grazer',
  [GIANT_ROLE.drifter]: 'Drifter',
};

export function giantRoleOf(species: GiantSpecies): GiantRole {
  return GIANT_ROLE_BY_SPECIES[species];
}
