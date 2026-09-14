// The picker's one highlight (docs/ui/overlays.md §3.2): highlight = hover or keyboard focus = preview. The hovered
// card wins, the focused one holds the highlight when the pointer leaves, and both claims belong to the offer they
// were made on, so a new offer replacing the cards in place starts with nothing highlighted. Pure: the overlay folds
// the cards' pointer and focus changes through it.

import type { ValueOf } from '@evolution/shared';

export const CARD_POINTER = { entered: 'entered', left: 'left', focused: 'focused', blurred: 'blurred' } as const;
export type CardPointer = ValueOf<typeof CARD_POINTER>;

/** One card's hover or focus change. */
export interface CardPointerEvent {
  readonly kind: CardPointer;
  readonly cardIndex: number;
}

export interface CardHighlight {
  /** The offer the two claims were made on; `null` before any card event. */
  readonly offerId: number | null;
  readonly hoveredIndex: number | null;
  readonly focusedIndex: number | null;
}

export const NO_CARD_HIGHLIGHT: CardHighlight = { offerId: null, hoveredIndex: null, focusedIndex: null };

type ClaimSlot = 'hoveredIndex' | 'focusedIndex';

const SLOT_OF: Readonly<Record<CardPointer, ClaimSlot>> = {
  [CARD_POINTER.entered]: 'hoveredIndex',
  [CARD_POINTER.left]: 'hoveredIndex',
  [CARD_POINTER.focused]: 'focusedIndex',
  [CARD_POINTER.blurred]: 'focusedIndex',
};

const IS_CLAIM: Readonly<Record<CardPointer, boolean>> = {
  [CARD_POINTER.entered]: true,
  [CARD_POINTER.left]: false,
  [CARD_POINTER.focused]: true,
  [CARD_POINTER.blurred]: false,
};

/** The highlight after `event` on the offer `offerId`; claims made on an earlier offer are dropped first. */
export function nextCardHighlight(highlight: CardHighlight, offerId: number, event: CardPointerEvent): CardHighlight {
  const current = highlight.offerId === offerId ? highlight : { ...NO_CARD_HIGHLIGHT, offerId };
  const slot = SLOT_OF[event.kind];
  if (IS_CLAIM[event.kind]) return { ...current, [slot]: event.cardIndex };
  // A leave or a blur ends only its own card's claim: a late one from a card already let go changes nothing.
  return current[slot] === event.cardIndex ? { ...current, [slot]: null } : current;
}

/** The highlighted card of `offerId`: the hovered one, else the focused one; `null` for none. */
export function highlightedCardIndex(highlight: CardHighlight, offerId: number): number | null {
  return highlight.offerId === offerId ? (highlight.hoveredIndex ?? highlight.focusedIndex) : null;
}
