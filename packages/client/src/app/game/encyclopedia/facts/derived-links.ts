// Links computed from the live balance's structure (docs/architecture/encyclopedia.md §12.3): a closed table, the
// same shape as the formula table, so content names a row and a typed argument and never writes a target that can
// drift from the catalog. A row returns its targets in the table's order; the fact resolver makes one fact per
// target and none for a row with no target (a trait that requires nothing).

import type { BalanceConfig, CellStage, DnaTag, SpawnedKind, TraitId, ValueOf, ZoneId } from '@evolution/shared';
import { nonIdentityModifiers } from '../../quantities/modifier-labels';
import { ABILITY_BY_MODIFIER, type AbilityId } from '../model/abilities';
import { ENTRY_SUBJECT, entryIdOf, type EntryId } from '../model/entry-id';
import { traitRowOf } from './catalog-quantities';

export const DERIVED_LINK = {
  /** The stage a trait is offered from. */
  traitStage: 'trait_stage',
  /** The traits it requires. */
  traitRequires: 'trait_requires',
  /** The bacterium variant that unlocks an endosymbiont. */
  traitUnlockVariant: 'trait_unlock_variant',
  /** `balance.ladder.STAGE_GATE_TRAITS[stage]`. */
  stageGateTraits: 'stage_gate_traits',
  /** The stage a gate trait climbs to. */
  stageNext: 'stage_next',
  /** Zones with a non-zero weight in `balance.ecology.FOOD_ZONE_WEIGHTS_BY_KIND`. */
  foodZones: 'food_zones',
  /** Traits whose tiers set one of the ability's modifier keys away from identity. */
  abilityTraits: 'ability_traits',
  /** Traits whose catalog row carries the tag. */
  tagTraits: 'tag_traits',
} as const;
export type DerivedLinkId = ValueOf<typeof DERIVED_LINK>;

export interface DerivedLinkArguments {
  [DERIVED_LINK.traitStage]: { readonly traitId: TraitId };
  [DERIVED_LINK.traitRequires]: { readonly traitId: TraitId };
  [DERIVED_LINK.traitUnlockVariant]: { readonly traitId: TraitId };
  [DERIVED_LINK.stageGateTraits]: { readonly stage: CellStage };
  [DERIVED_LINK.stageNext]: { readonly traitId: TraitId };
  [DERIVED_LINK.foodZones]: { readonly foodKind: SpawnedKind };
  [DERIVED_LINK.abilityTraits]: { readonly abilityId: AbilityId };
  [DERIVED_LINK.tagTraits]: { readonly tag: DnaTag };
}

export type DerivedLinkCall = {
  [Id in DerivedLinkId]: { readonly id: Id; readonly argument: DerivedLinkArguments[Id] };
}[DerivedLinkId];

const NO_WEIGHT = 0;

function traitEntryIds(traitIds: readonly TraitId[]): EntryId[] {
  return traitIds.map((traitId) => entryIdOf(ENTRY_SUBJECT.trait, traitId));
}

function catalogTraitIds(balance: BalanceConfig): readonly TraitId[] {
  return balance.traits.TRAIT_CATALOG.map((row) => row.id);
}

/** Whether any tier of `traitId` sets one of the ability's modifier keys away from identity. */
function grantsAbility(balance: BalanceConfig, traitId: TraitId, abilityId: AbilityId): boolean {
  return balance.traits.TRAIT_TIERS[traitId].some((tierRow) =>
    nonIdentityModifiers(tierRow, balance.traits.DEFAULT_CELL_MODIFIERS).some(
      ([key]) => ABILITY_BY_MODIFIER[key] === abilityId,
    ),
  );
}

export const DERIVED_LINKS: {
  readonly [Id in DerivedLinkId]: (balance: BalanceConfig, argument: DerivedLinkArguments[Id]) => readonly EntryId[];
} = {
  [DERIVED_LINK.traitStage]: (balance, argument) => [
    entryIdOf(ENTRY_SUBJECT.stage, traitRowOf(balance, argument.traitId).stage),
  ],
  [DERIVED_LINK.traitRequires]: (balance, argument) => traitEntryIds(traitRowOf(balance, argument.traitId).requires),
  [DERIVED_LINK.traitUnlockVariant]: (balance, argument) => {
    const unlock = traitRowOf(balance, argument.traitId).unlockedBy;
    return unlock === undefined ? [] : [entryIdOf(ENTRY_SUBJECT.bacterium, unlock.bacteriumVariant)];
  },
  [DERIVED_LINK.stageGateTraits]: (balance, argument) =>
    traitEntryIds(balance.ladder.STAGE_GATE_TRAITS[argument.stage]),
  [DERIVED_LINK.stageNext]: (balance, argument) =>
    balance.ladder.STAGE_ORDER.filter((stage) =>
      balance.ladder.STAGE_GATE_TRAITS[stage].includes(argument.traitId),
    ).map((stage) => entryIdOf(ENTRY_SUBJECT.stage, stage)),
  [DERIVED_LINK.foodZones]: (balance, argument) =>
    Object.entries(balance.ecology.FOOD_ZONE_WEIGHTS_BY_KIND[argument.foodKind])
      .filter(([, weight]) => weight > NO_WEIGHT)
      .map(([zone]) => entryIdOf(ENTRY_SUBJECT.zone, zone as ZoneId)),
  [DERIVED_LINK.abilityTraits]: (balance, argument) =>
    traitEntryIds(catalogTraitIds(balance).filter((traitId) => grantsAbility(balance, traitId, argument.abilityId))),
  [DERIVED_LINK.tagTraits]: (balance, argument) =>
    traitEntryIds(
      balance.traits.TRAIT_CATALOG.filter((row) => (row.tags as readonly DnaTag[]).includes(argument.tag)).map(
        (row) => row.id,
      ),
    ),
};

export function derivedLinkTargets(balance: BalanceConfig, call: DerivedLinkCall): readonly EntryId[] {
  const link = DERIVED_LINKS[call.id] as (
    balance: BalanceConfig,
    argument: DerivedLinkCall['argument'],
  ) => readonly EntryId[];
  return link(balance, call.argument);
}
