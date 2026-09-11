// docs/PROGRESSION.md §4: the offer lifecycle.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '@evolution/shared';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import {
  applyCard,
  applyExpiredOffer,
  applyTraitChoice,
  queueOffer,
  showQueuedOfferIfNone,
  shownOffer,
} from './offers.js';

const TIMEOUT_TICKS = DEFAULT_BALANCE.progression.TRAIT_CHOICE_TIMEOUT_SECONDS * 60;

function worldWithQueuedOffer(tick = 4) {
  const world = createTestWorld();
  world.tick = tick;
  const player = world.players[0]!;
  queueOffer(player);
  return { world, player, context: createTestStepContext(world) };
}

describe('queueOffer / showQueuedOfferIfNone', () => {
  it('queues unshown offers with increasing ids', () => {
    const player = createTestWorld().players[0]!;
    queueOffer(player);
    queueOffer(player);
    expect(player.offerQueue.map((offer) => [offer.offerId, offer.shownAtTick, offer.cards.length])).toEqual([
      [1, null, 0],
      [2, null, 0],
    ]);
    expect(player.nextOfferId).toBe(3);
    expect(player.offer).toBeNull();
  });

  it('builds the cards when shown, starts the timer and mirrors the view', () => {
    const { world, player, context } = worldWithQueuedOffer();
    showQueuedOfferIfNone(world, player, context);
    const offer = shownOffer(player)!;
    expect(offer.shownAtTick).toBe(4);
    expect(offer.expiresAtTick).toBe(4 + TIMEOUT_TICKS);
    expect(offer.cards.map((card) => card.traitId).sort()).toEqual(['cell_wall', 'nucleoid', 'simple_flagellum']);
    expect(offer.cardWeights).toHaveLength(3);
    expect(offer.catalogIndexes).toHaveLength(3);
    expect(player.offer).toEqual({ offerId: 1, cards: offer.cards, expiresAtTick: offer.expiresAtTick });
    expect(player.offer?.cards).not.toBe(offer.cards);
  });

  it('shows nothing while an offer is shown, and nothing when the queue is empty', () => {
    const { world, player, context } = worldWithQueuedOffer();
    queueOffer(player);
    showQueuedOfferIfNone(world, player, context);
    world.tick = 9;
    showQueuedOfferIfNone(world, player, context);
    expect(shownOffer(player)?.offerId).toBe(1);
    expect(player.offerQueue[1]?.shownAtTick).toBeNull();
    const fresh = createTestWorld();
    showQueuedOfferIfNone(fresh, fresh.players[0]!, createTestStepContext(fresh));
    expect(fresh.players[0]!.offer).toBeNull();
  });

  it('drops a candidate-less offer for the mass bonus, or keeps it queued without a cell', () => {
    const { world, player, context } = worldWithQueuedOffer();
    player.ownedTraits = DEFAULT_BALANCE.traits.TRAIT_CATALOG.map((trait) => ({ traitId: trait.id, tier: 3 as const }));
    const cell = world.cells[0]!;
    const massBefore = cell.mass;
    showQueuedOfferIfNone(world, player, context);
    expect(player.offerQueue).toHaveLength(0);
    expect(cell.mass).toBe(massBefore + DEFAULT_BALANCE.progression.LEVEL_UP_NO_DRAFT_MASS_BONUS);
    queueOffer(player);
    world.cells = [];
    showQueuedOfferIfNone(world, player, context);
    expect(player.offerQueue).toHaveLength(1);
    expect(shownOffer(player)).toBeUndefined();
  });
});

describe('applyTraitChoice', () => {
  it('applies the picked card, closes the offer and does not show the next one', () => {
    const { world, player, context } = worldWithQueuedOffer();
    queueOffer(player);
    showQueuedOfferIfNone(world, player, context);
    const card = shownOffer(player)!.cards[1]!;
    expect(applyTraitChoice(player, { offerId: 1, cardIndex: 1 }, context)).toBe(true);
    expect(player.ownedTraits).toEqual([card]);
    expect(player.offer).toBeNull();
    expect(player.offerQueue[0]).toMatchObject({ offerId: 2, shownAtTick: null });
    expect(context.rejections.staleTraitChoice).toBe(0);
  });

  it('ignores and counts a stale offer id, an out-of-range card and a pick with nothing shown', () => {
    const { world, player, context } = worldWithQueuedOffer();
    expect(applyTraitChoice(player, { offerId: 1, cardIndex: 0 }, context)).toBe(false);
    showQueuedOfferIfNone(world, player, context);
    expect(applyTraitChoice(player, { offerId: 7, cardIndex: 0 }, context)).toBe(false);
    expect(applyTraitChoice(player, { offerId: 1, cardIndex: 3 }, context)).toBe(false);
    expect(context.rejections.staleTraitChoice).toBe(3);
    expect(shownOffer(player)?.offerId).toBe(1);
  });
});

describe('applyExpiredOffer', () => {
  it('auto-picks the heaviest card on the boundary tick and not before (P3: nucleoid)', () => {
    const { world, player, context } = worldWithQueuedOffer(12);
    showQueuedOfferIfNone(world, player, context);
    world.tick = 12 + TIMEOUT_TICKS - 1;
    applyExpiredOffer(world, player);
    expect(shownOffer(player)?.offerId).toBe(1);
    world.tick = 12 + TIMEOUT_TICKS;
    applyExpiredOffer(world, player);
    expect(shownOffer(player)).toBeUndefined();
    expect(player.ownedTraits).toEqual([{ traitId: 'nucleoid', tier: 1 }]);
  });
});

describe('applyCard', () => {
  it('adds a new trait in first-owned order and upgrades an owned one in place', () => {
    const player = createTestWorld().players[0]!;
    applyCard(player, { traitId: 'cell_wall', tier: 1 });
    applyCard(player, { traitId: 'nucleoid', tier: 1 });
    applyCard(player, { traitId: 'cell_wall', tier: 2 });
    expect(player.ownedTraits).toEqual([
      { traitId: 'cell_wall', tier: 2 },
      { traitId: 'nucleoid', tier: 1 },
    ]);
  });
});
