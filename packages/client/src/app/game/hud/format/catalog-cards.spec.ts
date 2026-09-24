// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, TRAIT_CATALOG } from '@evolution/shared';
import { catalogCardId, catalogCards } from './catalog-cards';
import { tierNumeral } from './trait-cards';

const cards = catalogCards(DEFAULT_BALANCE.traits);
const tierCountOf = (traitId: string): number =>
  DEFAULT_BALANCE.traits.TRAIT_TIERS[traitId as keyof typeof DEFAULT_BALANCE.traits.TRAIT_TIERS]?.length ?? 0;

describe('catalogCards', () => {
  it('deals every trait at every tier fresh, and every tier past the first as an upgrade too', () => {
    const expected = TRAIT_CATALOG.flatMap((trait) =>
      Array.from({ length: tierCountOf(trait.id) }, (_unused, tierIndex) => tierIndex + 1).flatMap((tier) =>
        tier === 1
          ? [catalogCardId(trait.id, tier, null)]
          : [catalogCardId(trait.id, tier, null), catalogCardId(trait.id, tier, tier - 1)],
      ),
    );
    expect(cards.map((card) => card.cardId)).toEqual(expected);
    expect(new Set(cards.map((card) => card.view.index)).size).toBe(cards.length);
  });

  it('draws an upgrade with the longer `I → II` name the picker shows, and a fresh card with its tier alone', () => {
    const [trait] = TRAIT_CATALOG;
    const fresh = cards.find((card) => card.cardId === catalogCardId(trait.id, 2, null));
    const upgrade = cards.find((card) => card.cardId === catalogCardId(trait.id, 2, 1));
    expect(fresh?.view.isUpgrade).toBe(false);
    expect(fresh?.view.tierLabel).toBe(tierNumeral(2));
    expect(upgrade?.view.isUpgrade).toBe(true);
    expect(upgrade?.view.tierLabel).toContain(tierNumeral(1));
    expect(upgrade?.view.tierLabel).toContain(tierNumeral(2));
  });
});
