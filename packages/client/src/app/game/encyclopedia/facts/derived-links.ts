// Links computed from the live balance's structure (docs/architecture/encyclopedia.md §12.3): a closed table, the
// same shape as the formula table, so content names a row and a typed argument and never writes a target that can
// drift from the catalog. A row returns its targets in the table's order; the fact resolver makes one fact per
// target and none for a row with no target (a trait that requires nothing).

import type {
  BacteriumVariant,
  BalanceConfig,
  CellStage,
  DnaTag,
  SpawnedKind,
  TraitDefinition,
  TraitId,
  ValueOf,
  ZoneId,
} from '@evolution/shared';
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
  /** The traits a stage opens: catalog rows whose `stage` is it. */
  stageTraits: 'stage_traits',
  /** Zones with a non-zero weight in `balance.ecology.FOOD_ZONE_WEIGHTS_BY_KIND`. */
  foodZones: 'food_zones',
  /** Traits whose tiers set one of the ability's modifier keys away from identity. */
  abilityTraits: 'ability_traits',
  /** Traits whose catalog row carries the tag. */
  tagTraits: 'tag_traits',
  /** The endosymbionts a bacterium variant unlocks: catalog rows whose `unlockedBy` names it. */
  variantUnlocks: 'variant_unlocks',
  /** The tags a zone's DNA fragments can carry: non-zero weights in `DNA_FRAGMENT_TAG_TABLE_BY_ZONE[zone]`. */
  zoneFragmentTags: 'zone_fragment_tags',
  /** The zones whose DNA fragments can carry a tag. */
  fragmentTagZones: 'fragment_tag_zones',
} as const;
export type DerivedLinkId = ValueOf<typeof DERIVED_LINK>;

export interface DerivedLinkArguments {
  [DERIVED_LINK.traitStage]: { readonly traitId: TraitId };
  [DERIVED_LINK.traitRequires]: { readonly traitId: TraitId };
  [DERIVED_LINK.traitUnlockVariant]: { readonly traitId: TraitId };
  [DERIVED_LINK.stageGateTraits]: { readonly stage: CellStage };
  [DERIVED_LINK.stageNext]: { readonly traitId: TraitId };
  [DERIVED_LINK.stageTraits]: { readonly stage: CellStage };
  [DERIVED_LINK.foodZones]: { readonly foodKind: SpawnedKind };
  [DERIVED_LINK.abilityTraits]: { readonly abilityId: AbilityId };
  [DERIVED_LINK.tagTraits]: { readonly tag: DnaTag };
  [DERIVED_LINK.variantUnlocks]: { readonly variant: BacteriumVariant };
  [DERIVED_LINK.zoneFragmentTags]: { readonly zone: ZoneId };
  [DERIVED_LINK.fragmentTagZones]: { readonly tag: DnaTag };
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

/** Whether a DNA fragment spawned in `zone` can carry `tag`. */
function isFragmentTagOf(balance: BalanceConfig, zone: ZoneId, tag: DnaTag): boolean {
  return (balance.ecology.DNA_FRAGMENT_TAG_TABLE_BY_ZONE[zone][tag] ?? NO_WEIGHT) > NO_WEIGHT;
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
  [DERIVED_LINK.stageTraits]: (balance, argument) =>
    traitEntryIds(balance.traits.TRAIT_CATALOG.filter((row) => row.stage === argument.stage).map((row) => row.id)),
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
  [DERIVED_LINK.variantUnlocks]: (balance, argument) =>
    traitEntryIds(
      (balance.traits.TRAIT_CATALOG as readonly TraitDefinition[])
        .filter((row) => row.unlockedBy?.bacteriumVariant === argument.variant)
        .map((row) => row.id),
    ),
  [DERIVED_LINK.zoneFragmentTags]: (balance, argument) =>
    balance.progression.DNA_TAGS.filter((tag) => isFragmentTagOf(balance, argument.zone, tag)).map((tag) =>
      entryIdOf(ENTRY_SUBJECT.dnaTag, tag),
    ),
  [DERIVED_LINK.fragmentTagZones]: (balance, argument) =>
    (Object.keys(balance.ecology.DNA_FRAGMENT_TAG_TABLE_BY_ZONE) as ZoneId[])
      .filter((zone) => isFragmentTagOf(balance, zone, argument.tag))
      .map((zone) => entryIdOf(ENTRY_SUBJECT.zone, zone)),
};

export function derivedLinkTargets(balance: BalanceConfig, call: DerivedLinkCall): readonly EntryId[] {
  const link = DERIVED_LINKS[call.id] as (
    balance: BalanceConfig,
    argument: DerivedLinkCall['argument'],
  ) => readonly EntryId[];
  return link(balance, call.argument);
}
