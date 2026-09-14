import { describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  TICK_HZ,
  type CellView,
  type TraitId,
  type TraitOfferView,
} from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { describeTierModifiers } from './trait-effects';
import { traitOfferViewFor } from './trait-cards';

const WINDOW_SECONDS = DEFAULT_BALANCE.progression.TRAIT_CHOICE_TIMEOUT_SECONDS;
const EXPIRES_AT = 10_000;

const offer: TraitOfferView = {
  offerId: 7,
  expiresAtTick: EXPIRES_AT,
  cards: [
    { traitId: 'nucleoid' as TraitId, tier: 1 },
    { traitId: 'simple_flagellum' as TraitId, tier: 2 },
    { traitId: 'cell_wall' as TraitId, tier: 1 },
  ],
};

const protocell = createTestCellView({
  stage: CELL_STAGE.protocell,
  traits: [{ traitId: 'simple_flagellum' as TraitId, tier: 1 }],
});

function viewAt(secondsLeft: number, ownCell: CellView | null = protocell) {
  return traitOfferViewFor({
    offer,
    level: 5,
    ownCell,
    serverTick: EXPIRES_AT - secondsLeft * TICK_HZ,
    balance: DEFAULT_BALANCE,
  });
}

describe('traitOfferViewFor', () => {
  it('titles the band with the level and builds one card per offered trait, keyed 1 2 3', () => {
    const view = viewAt(6.5);
    expect(view.title).toBe('LEVEL 5 · CHOOSE A TRAIT');
    expect(view.offerId).toBe(7);
    expect(view.cards.map((card) => card.keyLabel)).toEqual(['1', '2', '3']);
    expect(view.cards[0]).toMatchObject({
      name: 'Nucleoid Coil',
      tierLabel: 'I',
      category: 'genome',
      rarity: 'common',
    });
    expect(view.cards[0]!.effects).toEqual(describeTierModifiers('nucleoid' as TraitId, 1));
  });

  it('ribbons the card that is the next stage’s gate, and marks an owned trait’s card as its upgrade', () => {
    const [nucleoid, flagellum, wall] = viewAt(6.5).cards;
    expect(nucleoid!.isRung).toBe(true);
    expect(flagellum).toMatchObject({ isRung: false, isUpgrade: true, tierLabel: 'I → II' });
    expect(wall).toMatchObject({ isRung: false, isUpgrade: false, tierLabel: 'I' });
  });

  it('knows neither the rung nor the upgrade while spectating', () => {
    const cards = viewAt(6.5, null).cards;
    expect(cards.some((card) => card.isRung || card.isUpgrade)).toBe(false);
  });

  it('counts down from the newest snapshot tick and fills the bar by the share of the window left', () => {
    const view = viewAt(6.5);
    expect(view.secondsText).toBe('6.5 s');
    expect(view.timerFraction).toBeCloseTo(6.5 / WINDOW_SECONDS, 9);
  });

  it('never counts below zero or above the window', () => {
    expect(viewAt(-3)).toMatchObject({ secondsLeft: 0, secondsText: '0.0 s', timerFraction: 0 });
    expect(viewAt(WINDOW_SECONDS * 2)).toMatchObject({ secondsLeft: WINDOW_SECONDS, timerFraction: 1 });
  });
});
