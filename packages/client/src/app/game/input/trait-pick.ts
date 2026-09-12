// The one policy for a `1` `2` `3` press (docs/UI.md §4). A press is not a bare card index: it is
// an answer to the offer that was on screen when it was made, and the three cases are settled here
// so no caller has half of the rule.
//
//  1. **A press answers only the offer it was made against.** The press is stamped with that
//     offer's `offerId` (`traitPickFor`), so it can never be spent on a later one.
//  2. **An unanswerable press is discarded, not carried.** No offer open, or an index past the
//     cards this offer actually has — late drafts carry fewer than `TRAIT_DRAFT_SIZE`
//     (docs/PROGRESSION.md §4) — and the press is dropped where it was made.
//  3. **A press the server rejects as stale can still be retried.** The pick stays queued until
//     the world says what became of it: once the server has answered a tick at or past the one it
//     was sent with and the offer it names is *still* open, the pick did not take and is sent
//     again. Once that offer is gone from the client's model — picked, timed out, or replaced —
//     the pick is discarded. So it is sent once in the good case and never applied twice.

import type { TraitOfferView, ValueOf } from '@evolution/shared';
import type { InputWorldContext } from './game-input-builder';

/** A card press bound to the offer it answers. */
export interface QueuedTraitPick {
  readonly offerId: number;
  readonly cardIndex: number;
  /** The `sequence` it was last sent with; `null` until it has been sent once. */
  readonly sentAtSequence: number | null;
}

export const TRAIT_PICK_STATUS = {
  /** The offer it answers is gone: drop it (case 2 on arrival, case 3 once resolved). */
  discard: 'discard',
  /** Sent, and the server has not answered that far yet: hold it. */
  waiting: 'waiting',
  send: 'send',
} as const;

export type TraitPickStatus = ValueOf<typeof TRAIT_PICK_STATUS>;

/** Whether `cardIndex` names a card the offer actually has. */
function hasCard(offer: TraitOfferView, cardIndex: number): boolean {
  return cardIndex >= 0 && cardIndex < offer.cards.length;
}

/** Case 1 and 2: the pick a press makes, or `null` when no open offer can answer it. */
export function traitPickFor(cardIndex: number, offer: TraitOfferView | null): QueuedTraitPick | null {
  if (offer === null || !hasCard(offer, cardIndex)) return null;
  return { offerId: offer.offerId, cardIndex, sentAtSequence: null };
}

/** What to do with a queued pick against the world as the client now sees it. */
export function traitPickStatus(pick: QueuedTraitPick, world: InputWorldContext): TraitPickStatus {
  const { offer } = world;
  if (offer === null || offer.offerId !== pick.offerId || !hasCard(offer, pick.cardIndex)) {
    return TRAIT_PICK_STATUS.discard;
  }
  if (pick.sentAtSequence === null) return TRAIT_PICK_STATUS.send;
  // The server has answered for a tick at or past the send and this offer is still open in that
  // same snapshot, so the pick was rejected (a stale choice) rather than applied: try again.
  return world.appliedInputSequence >= pick.sentAtSequence ? TRAIT_PICK_STATUS.send : TRAIT_PICK_STATUS.waiting;
}
