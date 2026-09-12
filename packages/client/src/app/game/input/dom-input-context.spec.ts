import { afterEach, describe, expect, it } from 'vitest';
import { MENU_OVERLAY_TEST_ID, RESULTS_OVERLAY_TEST_ID, TRAIT_OFFER_TEST_ID } from './input-constants';
import { focusContextOf } from './dom-input-context';

function mount(html: string): void {
  document.body.innerHTML = html;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('focusContextOf', () => {
  it('reads an empty document as free focus', () => {
    mount('');
    expect(focusContextOf(document)).toEqual({
      isTextEntryFocused: false,
      isTraitOfferFocused: false,
      isMenuOpen: false,
      hasFocusableOverlay: false,
    });
  });

  it('sees focus in a text field', () => {
    mount('<input id="name" />');
    document.querySelector<HTMLInputElement>('#name')?.focus();
    expect(focusContextOf(document).isTextEntryFocused).toBe(true);
  });

  it('sees focus inside the trait picker, on the card as well as on the container', () => {
    mount(`<div data-testid="${TRAIT_OFFER_TEST_ID}"><button id="card">Card</button></div>`);
    document.querySelector<HTMLButtonElement>('#card')?.focus();
    const context = focusContextOf(document);
    expect(context.isTraitOfferFocused).toBe(true);
    expect(context.hasFocusableOverlay).toBe(true);
  });

  it('does not call the picker focused when focus is elsewhere', () => {
    mount(`<div data-testid="${TRAIT_OFFER_TEST_ID}"></div><button id="other">Other</button>`);
    document.querySelector<HTMLButtonElement>('#other')?.focus();
    expect(focusContextOf(document).isTraitOfferFocused).toBe(false);
  });

  it('sees the menu open', () => {
    mount(`<div data-testid="${MENU_OVERLAY_TEST_ID}"></div>`);
    const context = focusContextOf(document);
    expect(context.isMenuOpen).toBe(true);
    expect(context.hasFocusableOverlay).toBe(true);
  });

  it('counts the results panel as an overlay with focusable controls', () => {
    mount(`<div data-testid="${RESULTS_OVERLAY_TEST_ID}"></div>`);
    const context = focusContextOf(document);
    expect(context.isMenuOpen).toBe(false);
    expect(context.hasFocusableOverlay).toBe(true);
  });
});
