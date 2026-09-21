// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  CARD_POINTER,
  NO_CARD_HIGHLIGHT,
  highlightedCardIndex,
  nextCardHighlight,
  type CardHighlight,
  type CardPointer,
} from './card-highlight';

const OFFER_ID = 3;
const NEXT_OFFER_ID = 4;

function fold(
  events: readonly (readonly [CardPointer, number])[],
  offerId = OFFER_ID,
  from: CardHighlight = NO_CARD_HIGHLIGHT,
): CardHighlight {
  return events.reduce(
    (highlight, [kind, cardIndex]) => nextCardHighlight(highlight, offerId, { kind, cardIndex }),
    from,
  );
}

describe('card highlight', () => {
  it('highlights nothing until a card is hovered or focused', () => {
    expect(highlightedCardIndex(NO_CARD_HIGHLIGHT, OFFER_ID)).toBeNull();
  });

  it('prefers the hovered card, and hands the highlight back to the focused card when the pointer leaves', () => {
    const focused = fold([[CARD_POINTER.focused, 0]]);
    expect(highlightedCardIndex(focused, OFFER_ID)).toBe(0);
    const hovered = fold([[CARD_POINTER.entered, 1]], OFFER_ID, focused);
    expect(highlightedCardIndex(hovered, OFFER_ID)).toBe(1);
    expect(highlightedCardIndex(fold([[CARD_POINTER.left, 1]], OFFER_ID, hovered), OFFER_ID)).toBe(0);
  });

  it('lets a blur end the focus claim', () => {
    expect(
      highlightedCardIndex(
        fold([
          [CARD_POINTER.focused, 2],
          [CARD_POINTER.blurred, 2],
        ]),
        OFFER_ID,
      ),
    ).toBeNull();
  });

  it('ignores a late leave from a card that no longer holds the hover', () => {
    const highlight = fold([
      [CARD_POINTER.entered, 1],
      [CARD_POINTER.entered, 2],
      [CARD_POINTER.left, 1],
    ]);
    expect(highlightedCardIndex(highlight, OFFER_ID)).toBe(2);
  });

  it('forgets every claim when a new offer replaces the cards in place', () => {
    const onFirstOffer = fold([
      [CARD_POINTER.focused, 0],
      [CARD_POINTER.entered, 1],
    ]);
    expect(highlightedCardIndex(onFirstOffer, NEXT_OFFER_ID)).toBeNull();
    expect(fold([[CARD_POINTER.entered, 2]], NEXT_OFFER_ID, onFirstOffer)).toEqual({
      offerId: NEXT_OFFER_ID,
      hoveredIndex: 2,
      focusedIndex: null,
    });
  });
});
