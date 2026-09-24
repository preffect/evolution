// Every trait card the catalog can deal (#428): each trait at each of its tiers as a fresh card, and each tier past
// the first as the upgrade from the tier below it, which is the card with the longer `I → II` name. The card sheet
// dev route draws these so a browser spec can measure every one against the card's height; a line count cannot,
// because a long line wraps onto rows the count never sees. Pure.

import {
  CELL_STAGE,
  FIRST_TIER,
  TRAIT_CATALOG,
  tierOfRowIndex,
  type OwnedTrait,
  type TraitId,
} from '@evolution/shared';
import type { TraitModifierTables } from './trait-effects';
import { traitCardViewFor, type TraitCardView } from './trait-cards';

/** One catalog card and the name the sheet gives it. */
export interface CatalogCard {
  /** `cilia-2`, or `cilia-1-2` for the upgrade from tier I to tier II. */
  readonly cardId: string;
  readonly view: TraitCardView;
}

/** `cilia-2`, or `cilia-1-2` for an upgrade from `ownedTier`. */
export function catalogCardId(traitId: TraitId, tier: number, ownedTier: number | null): string {
  return ownedTier === null ? `${traitId}-${tier}` : `${traitId}-${ownedTier}-${tier}`;
}

/** Every trait at every tier, fresh and as an upgrade, in catalog order. */
export function catalogCards(traits: TraitModifierTables): readonly CatalogCard[] {
  const offered = TRAIT_CATALOG.flatMap((definition) =>
    (traits.TRAIT_TIERS[definition.id] ?? []).flatMap((_row, rowIndex) => {
      const card: OwnedTrait = { traitId: definition.id, tier: tierOfRowIndex(rowIndex) };
      const fresh = { card, owned: null };
      if (card.tier === FIRST_TIER) return [fresh];
      // The tier below: its row is the one before this one.
      return [fresh, { card, owned: { traitId: definition.id, tier: tierOfRowIndex(rowIndex - 1) } }];
    }),
  );
  return offered.map(({ card, owned }, index) => ({
    cardId: catalogCardId(card.traitId, card.tier, owned?.tier ?? null),
    // The protocell stage, so the gates of the first rung carry their ribbon; it is drawn over the card's corner
    // and takes no height, so the stage changes nothing the sheet measures.
    view: traitCardViewFor(
      card,
      index,
      { ownedTraits: owned === null ? [] : [owned], stage: CELL_STAGE.protocell },
      traits,
    ),
  }));
}
