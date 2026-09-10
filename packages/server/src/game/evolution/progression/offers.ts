// The offer lifecycle (docs/PROGRESSION.md §4): level-up → queued → shown (cards built at show
// time, timer starts) → pick or timeout → applied → the next queued offer. Offers are shown at
// step 1 before the input applies and at step 7 right after a level-up; a pick at step 1 shows
// the next one on the next tick's step 1, so back-to-back offers see the previous pick (P6).

import {
  RANDOM_STREAM,
  secondsToTicks,
  type OwnedTrait,
  type TraitChoiceInput,
  type TraitTier,
} from '@evolution/shared';
import { gainMass } from '../simulation/cell-mass.js';
import type { PlayerRecord, TraitOffer } from '../world/entities.js';
import { findCellOfPlayer } from '../world/lookups.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { buildDraft, timeoutCardIndex, type Draft } from './draft.js';

/** Appends an unshown offer; its cards are built when it is shown. */
export function queueOffer(player: PlayerRecord): void {
  player.offerQueue.push({
    offerId: player.nextOfferId,
    cards: [],
    expiresAtTick: 0,
    shownAtTick: null,
    cardWeights: [],
    catalogIndexes: [],
  });
  player.nextOfferId += 1;
}

/** The offer the player is looking at, if any. */
export function shownOffer(player: PlayerRecord): TraitOffer | undefined {
  const head = player.offerQueue[0];
  return head !== undefined && head.shownAtTick !== null ? head : undefined;
}

/** Sets the trait to the card's tier, or adds it; array order is first-owned order. */
export function applyCard(player: PlayerRecord, card: OwnedTrait): void {
  const owned = player.ownedTraits.find((entry) => entry.traitId === card.traitId);
  if (owned === undefined) {
    player.ownedTraits.push({ traitId: card.traitId, tier: card.tier });
  } else {
    owned.tier = card.tier;
  }
}

function showOffer(offer: TraitOffer, draft: Draft, player: PlayerRecord, world: WorldState): void {
  offer.cards = draft.cards;
  offer.cardWeights = draft.cardWeights;
  offer.catalogIndexes = draft.catalogIndexes;
  offer.shownAtTick = world.tick;
  offer.expiresAtTick = world.tick + secondsToTicks(world.balance.progression.TRAIT_CHOICE_TIMEOUT_SECONDS);
  player.offer = {
    offerId: offer.offerId,
    cards: draft.cards.map((card) => ({ ...card })),
    expiresAtTick: offer.expiresAtTick,
  };
}

/**
 * Shows the head of the queue when nothing is shown. Zero candidates: the offer is dropped and the
 * cell gains `LEVEL_UP_NO_DRAFT_MASS_BONUS` instead; without a cell the offer waits.
 */
export function showQueuedOfferIfNone(world: WorldState, player: PlayerRecord, context: StepContext): void {
  const head = player.offerQueue[0];
  if (head === undefined || head.shownAtTick !== null) {
    return;
  }
  const draft = buildDraft(player, context.streams[RANDOM_STREAM.traitDraft], context.balance);
  if (draft.cards.length > 0) {
    showOffer(head, draft, player, world);
    return;
  }
  const cell = findCellOfPlayer(world, player.playerId);
  if (cell !== undefined) {
    player.offerQueue.shift();
    gainMass(cell, player, context.balance.progression.LEVEL_UP_NO_DRAFT_MASS_BONUS, context.balance);
  }
}

function closeShownOffer(player: PlayerRecord, offer: TraitOffer, cardIndex: number): void {
  applyCard(player, offer.cards[cardIndex] as OwnedTrait);
  player.offerQueue.shift();
  player.offer = null;
}

/** Applies a pick on the shown offer; a stale or out-of-range pick is ignored and counted. */
export function applyTraitChoice(player: PlayerRecord, choice: TraitChoiceInput, context: StepContext): boolean {
  const offer = shownOffer(player);
  if (offer === undefined || offer.offerId !== choice.offerId || choice.cardIndex >= offer.cards.length) {
    context.rejections.staleTraitChoice += 1;
    return false;
  }
  closeShownOffer(player, offer, choice.cardIndex);
  return true;
}

/** The timeout: on the tick the shown offer reaches `expiresAtTick`, the heaviest card is picked. */
export function applyExpiredOffer(world: WorldState, player: PlayerRecord): void {
  const offer = shownOffer(player);
  if (offer === undefined || world.tick < offer.expiresAtTick) {
    return;
  }
  closeShownOffer(player, offer, timeoutCardIndex(offer));
}

/** The tier a card grants, for callers that build cards by hand (fixtures, debug). */
export function cardAt(traitId: OwnedTrait['traitId'], tier: TraitTier): OwnedTrait {
  return { traitId, tier };
}
