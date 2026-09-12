// The one place the input layer touches the DOM to answer "where is focus?" (docs/UI.md §4).
// Thin by design: it reads the document and returns the four facts `keyboard-action.ts` decides
// on, so every rule stays unit-testable without a browser.

import {
  FOCUSABLE_OVERLAY_TEST_IDS,
  MENU_OVERLAY_TEST_ID,
  TEXT_ENTRY_SELECTOR,
  TRAIT_OFFER_TEST_ID,
  testIdSelector,
} from './input-constants';
import type { FocusContext } from './keyboard-action';

function isOverlayOpen(ownerDocument: Document, testId: string): boolean {
  return ownerDocument.querySelector(testIdSelector(testId)) !== null;
}

/** The focused element as an `Element`, or `null` when focus is on the body or nowhere. */
function focusedElement(ownerDocument: Document): Element | null {
  const active = ownerDocument.activeElement;
  return active === null || active === ownerDocument.body ? null : active;
}

export function focusContextOf(ownerDocument: Document): FocusContext {
  const active = focusedElement(ownerDocument);
  return {
    isTextEntryFocused: active?.matches(TEXT_ENTRY_SELECTOR) ?? false,
    isTraitOfferFocused: active !== null && active.closest(testIdSelector(TRAIT_OFFER_TEST_ID)) !== null,
    isMenuOpen: isOverlayOpen(ownerDocument, MENU_OVERLAY_TEST_ID),
    hasFocusableOverlay: FOCUSABLE_OVERLAY_TEST_IDS.some((testId) => isOverlayOpen(ownerDocument, testId)),
  };
}
