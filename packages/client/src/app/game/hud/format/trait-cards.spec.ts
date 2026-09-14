import { describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  TICK_HZ,
  createTestPlayerProgressView,
  createTestTraitOfferView,
  type PlayerProgressView,
  type TraitId,
  type TraitOfferView,
  type TraitTier,
} from '@evolution/shared';
import { describeTierModifiers } from './trait-effects';
import { traitOfferViewFor } from './trait-cards';

const WINDOW_SECONDS = DEFAULT_BALANCE.progression.TRAIT_CHOICE_TIMEOUT_SECONDS;
const EXPIRES_AT = 10_000;

const offer = createTestTraitOfferView({
  offerId: 7,
  level: 5,
  expiresAtTick: EXPIRES_AT,
  cards: [
    { traitId: 'nucleoid' as TraitId, tier: 1 },
    { traitId: 'simple_flagellum' as TraitId, tier: 2 },
    { traitId: 'cell_wall' as TraitId, tier: 1 },
  ],
});

const protocell = createTestPlayerProgressView({
  level: 5,
  stage: CELL_STAGE.protocell,
  ownedTraits: [{ traitId: 'simple_flagellum' as TraitId, tier: 1 }],
});

function viewAt(secondsLeft: number, progress: PlayerProgressView = protocell, open: TraitOfferView = offer) {
  return traitOfferViewFor({
    offer: open,
    progress,
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

  it('titles a queued offer with the level that earned it, not the level the player has reached since', () => {
    const afterDoubleLevelUp = { ...protocell, level: 6 };
    expect(viewAt(6.5, afterDoubleLevelUp).title).toBe('LEVEL 5 · CHOOSE A TRAIT');
    expect(viewAt(6.5, afterDoubleLevelUp, { ...offer, offerId: 8, level: 6 }).title).toBe('LEVEL 6 · CHOOSE A TRAIT');
  });

  it('ribbons the card that is the next stage’s gate, and marks an owned trait’s card as its upgrade', () => {
    const [nucleoid, flagellum, wall] = viewAt(6.5).cards;
    expect(nucleoid!.isRung).toBe(true);
    expect(flagellum).toMatchObject({ isRung: false, isUpgrade: true, tierLabel: 'I → II' });
    expect(wall).toMatchObject({ isRung: false, isUpgrade: false, tierLabel: 'I' });
  });

  it('ribbons no card at the top of the ladder', () => {
    const top = { ...protocell, stage: CELL_STAGE.specialised };
    expect(viewAt(6.5, top).cards.some((card) => card.isRung)).toBe(false);
  });

  it('counts down from the newest snapshot tick and fills the bar by the share of the window left', () => {
    const view = viewAt(6.5);
    expect(view.secondsText).toBe('6.5 s');
    expect(view.timerFraction).toBeCloseTo(6.5 / WINDOW_SECONDS, 9);
  });

  it('refuses a trait the catalog does not know, and a tier with no numeral: both break the server contract', () => {
    const unknownTrait: TraitOfferView = { ...offer, cards: [{ traitId: 'no_such_trait' as TraitId, tier: 1 }] };
    expect(() => viewAt(6.5, protocell, unknownTrait)).toThrow(/no_such_trait/);
    // A tier past the table can only arrive over the wire, so the type has to be talked past to build one.
    const tierPastTable = Number('4') as TraitTier;
    const tierFour: TraitOfferView = { ...offer, cards: [{ traitId: 'nucleoid' as TraitId, tier: tierPastTable }] };
    expect(() => viewAt(6.5, protocell, tierFour)).toThrow(/tier 4/);
  });

  it('never counts below zero or above the window', () => {
    expect(viewAt(-3)).toMatchObject({ secondsLeft: 0, secondsText: '0.0 s', timerFraction: 0 });
    expect(viewAt(WINDOW_SECONDS * 2)).toMatchObject({ secondsLeft: WINDOW_SECONDS, timerFraction: 1 });
  });

  it('starts the countdown at the full window the tick the offer is shown', () => {
    expect(viewAt(WINDOW_SECONDS)).toMatchObject({
      secondsText: `${WINDOW_SECONDS.toFixed(1)} s`,
      timerFraction: 1,
    });
  });
});
