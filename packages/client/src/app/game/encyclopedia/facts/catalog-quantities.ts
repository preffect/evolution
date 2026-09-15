// Counts over the structure the balance carries (docs/architecture/encyclopedia.md §12.3): read from the live
// balance's copy of the catalog, never from a module import. Trait tier values are never catalog quantities (they
// are generated tier facts). A count that does not apply to its subject (the unlock count of a trait with no
// unlock) is `null`, and the fact is left out rather than shown as zero.

import type { BalanceConfig, TraitDefinition, TraitId, ValueOf } from '@evolution/shared';

export const CATALOG_QUANTITY = {
  /** `balance.traits.TRAIT_TIERS[traitId].length`. */
  tierCount: 'tier_count',
  /** The catalog row's `unlockedBy.count`: the one number read from catalog structure (constants-files-tests.md §9). */
  unlockCount: 'unlock_count',
  requiresCount: 'requires_count',
  /** `balance.ladder.STAGE_ORDER.length`. */
  stageCount: 'stage_count',
} as const;
export type CatalogQuantityId = ValueOf<typeof CATALOG_QUANTITY>;

/** Each selector's argument: a trait id where the count is per trait, nothing otherwise. */
export interface CatalogQuantityArguments {
  [CATALOG_QUANTITY.tierCount]: { readonly traitId: TraitId };
  [CATALOG_QUANTITY.unlockCount]: { readonly traitId: TraitId };
  [CATALOG_QUANTITY.requiresCount]: { readonly traitId: TraitId };
  [CATALOG_QUANTITY.stageCount]: Record<string, never>;
}

export type CatalogQuantityCall = {
  [Id in CatalogQuantityId]: { readonly id: Id; readonly argument: CatalogQuantityArguments[Id] };
}[CatalogQuantityId];

/** The catalog row of `traitId` in the live balance; an id with no row is a broken contract, refused loudly. */
export function traitRowOf(balance: BalanceConfig, traitId: TraitId): TraitDefinition {
  const row = (balance.traits.TRAIT_CATALOG as readonly TraitDefinition[]).find((trait) => trait.id === traitId);
  if (row === undefined) throw new Error(`The trait ${traitId} has no catalog row`);
  return row;
}

export const CATALOG_QUANTITIES: {
  readonly [Id in CatalogQuantityId]: (balance: BalanceConfig, argument: CatalogQuantityArguments[Id]) => number | null;
} = {
  [CATALOG_QUANTITY.tierCount]: (balance, argument) => balance.traits.TRAIT_TIERS[argument.traitId].length,
  [CATALOG_QUANTITY.unlockCount]: (balance, argument) =>
    traitRowOf(balance, argument.traitId).unlockedBy?.count ?? null,
  [CATALOG_QUANTITY.requiresCount]: (balance, argument) => traitRowOf(balance, argument.traitId).requires.length,
  [CATALOG_QUANTITY.stageCount]: (balance) => balance.ladder.STAGE_ORDER.length,
};

export function evaluateCatalogQuantity(balance: BalanceConfig, call: CatalogQuantityCall): number | null {
  const quantity = CATALOG_QUANTITIES[call.id] as (
    balance: BalanceConfig,
    argument: CatalogQuantityCall['argument'],
  ) => number | null;
  return quantity(balance, call.argument);
}
