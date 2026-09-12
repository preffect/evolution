import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, type TraitOfferView } from '@evolution/shared';
import type { InputWorldContext } from './game-input-builder';
import { TRAIT_PICK_STATUS, traitPickFor, traitPickStatus, type QueuedTraitPick } from './trait-pick';

const THREE_CARDS: TraitOfferView = {
  offerId: 5,
  cards: [
    { traitId: 'nucleoid', tier: 1 },
    { traitId: 'cell_wall', tier: 1 },
    { traitId: 'simple_flagellum', tier: 1 },
  ],
  expiresAtTick: 900,
};

/** A late draft with fewer cards than `TRAIT_DRAFT_SIZE` (docs/PROGRESSION.md §4). */
const TWO_CARDS: TraitOfferView = { ...THREE_CARDS, offerId: 8, cards: THREE_CARDS.cards.slice(0, 2) };

function world(overrides: Partial<InputWorldContext> = {}): InputWorldContext {
  return {
    ownCell: { x: 0, y: 0, radiusWu: 4 },
    offer: THREE_CARDS,
    controls: DEFAULT_BALANCE.controls,
    appliedInputSequence: 0,
    ...overrides,
  };
}

function pick(overrides: Partial<QueuedTraitPick> = {}): QueuedTraitPick {
  return { offerId: 5, cardIndex: 1, sentAtSequence: null, ...overrides };
}

describe('traitPickFor: a press answers only the offer it was made against', () => {
  it('binds the press to the offer that is open now', () => {
    expect(traitPickFor(1, THREE_CARDS)).toEqual({ offerId: 5, cardIndex: 1, sentAtSequence: null });
  });

  it('discards a press made with no offer open', () => {
    expect(traitPickFor(1, null)).toBeNull();
  });

  it('discards a press for a card the offer does not have, rather than carrying it', () => {
    expect(traitPickFor(2, TWO_CARDS)).toBeNull();
  });
});

describe('traitPickStatus', () => {
  it('sends a pick that has not gone out yet', () => {
    expect(traitPickStatus(pick(), world())).toBe(TRAIT_PICK_STATUS.send);
  });

  it('waits while the server has not answered as far as the send', () => {
    expect(traitPickStatus(pick({ sentAtSequence: 40 }), world({ appliedInputSequence: 39 }))).toBe(
      TRAIT_PICK_STATUS.waiting,
    );
  });

  it('sends again when the server answered past the send and the offer is still open', () => {
    expect(traitPickStatus(pick({ sentAtSequence: 40 }), world({ appliedInputSequence: 40 }))).toBe(
      TRAIT_PICK_STATUS.send,
    );
  });

  it('discards once the offer it answers has closed', () => {
    expect(traitPickStatus(pick({ sentAtSequence: 40 }), world({ offer: null, appliedInputSequence: 40 }))).toBe(
      TRAIT_PICK_STATUS.discard,
    );
  });

  it('discards when a different offer has taken its place, even on the same tick', () => {
    expect(traitPickStatus(pick(), world({ offer: TWO_CARDS }))).toBe(TRAIT_PICK_STATUS.discard);
  });

  it('discards when the offer it names no longer has that card', () => {
    const shrunk: TraitOfferView = { ...THREE_CARDS, cards: THREE_CARDS.cards.slice(0, 1) };
    expect(traitPickStatus(pick(), world({ offer: shrunk }))).toBe(TRAIT_PICK_STATUS.discard);
  });
});
