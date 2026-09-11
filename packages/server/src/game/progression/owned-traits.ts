// Fixture- and debug-granted traits (docs/ECOLOGY.md §8 "fixture-granted traits bypass the ladder";
// docs/ARCHITECTURE.md §8 `debug_set_player`): the one place a string trait id and a tier are checked
// against the catalog and turned into `OwnedTrait`s, so the scenario fixtures and the debug tools can
// never diverge. Callers wrap `UnknownTraitError` in their own refusal type.

import type { OwnedTrait, TraitDefinition, TraitId, TraitTier } from '@evolution/shared';

export class UnknownTraitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnknownTraitError';
  }
}

/** A trait to grant: `'cilia'` is tier I; the tier names the row of the trait's table (docs/TRAITS.md §2). */
export interface TraitGrant {
  readonly traitId: string;
  readonly tier?: number;
}

const FIRST_TIER: TraitTier = 1;

function toOwnedTrait(catalog: readonly TraitDefinition[], grant: TraitGrant): OwnedTrait {
  const trait = catalog.find((candidate) => candidate.id === grant.traitId);
  if (trait === undefined) {
    throw new UnknownTraitError(`"${grant.traitId}" is not a catalog trait`);
  }
  const tier = grant.tier ?? FIRST_TIER;
  if (!Number.isInteger(tier) || tier < FIRST_TIER || tier > trait.tiers.length) {
    throw new UnknownTraitError(`trait ${trait.id} has tiers ${FIRST_TIER} to ${trait.tiers.length}, got tier ${tier}`);
  }
  return { traitId: trait.id as TraitId, tier: tier as TraitTier };
}

/** The owned traits a list of grants names, in the given order. */
export function toOwnedTraits(catalog: readonly TraitDefinition[], grants: readonly TraitGrant[]): OwnedTrait[] {
  return grants.map((grant) => toOwnedTrait(catalog, grant));
}
