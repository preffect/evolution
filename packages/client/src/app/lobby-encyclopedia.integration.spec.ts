// The encyclopedia over the lobby (docs/testing/tiers-and-builders.md §2.2), which is acceptance U11 at the client
// tier: the lobby header's button opens the panel with no alert strip, and Escape closes it back to that button.
//
// The lobby is the host here, so it is the lobby's Escape that closes (§11.5), and it is the kit focus trap that puts
// focus back. Outside a room there is no `game_state`, so every value on the page comes from `DEFAULT_BALANCE`.

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppComponent } from './app.component';
import { expectTestId, queryByTestId } from '../testing/test-id-query';
import { ENCYCLOPEDIA_LOBBY_SCRIM_ALPHA } from './game/encyclopedia/encyclopedia-constants';
import { ENCYCLOPEDIA_TEST_ID } from './game/encyclopedia/test-ids';
import { EncyclopediaStateService } from './game/encyclopedia/encyclopedia-state.service';

describe('the encyclopedia over the lobby (acceptance U11)', () => {
  let fixture: ComponentFixture<AppComponent>;
  let encyclopedia: EncyclopediaStateService;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function lobbyButton(): HTMLElement {
    return expectTestId(root(), ENCYCLOPEDIA_TEST_ID.lobbyButton);
  }

  function pressEscape(): void {
    (document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AppComponent] });
    encyclopedia = TestBed.inject(EncyclopediaStateService);
    fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('draws the button in the lobby header and nothing else until it is pressed', () => {
    expect(lobbyButton()).not.toBeNull();
    expect(queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.encyclopedia)).toBeNull();
  });

  /**
   * **The control is a plain `<button>`, and that is a decision rather than an omission** (#449, PR #463).
   *
   * `layout.md` §2 puts `lobby-encyclopedia` in a table whose own rule is "every control is a native `<input>`,
   * `<select>` or `<button>`", and components-and-constants.md §10 says the lobby screens move onto the kit by their
   * own ticket, **#464**. Until that lands, dressing this one control in `uiButton` makes it *worse*: a kit
   * `secondary` button is `color: var(--ui-text)` over a `UI_SECONDARY_FILL_ALPHA` fill of the same colour — a light
   * label for the dark panel gradient — and the lobby around it is `#1a1a1a` on white. The surface has to come first.
   *
   * So this guard exists to make a naive swap a deliberate act: whoever takes #464 changes this line **and** gives
   * the lobby a kit ground, rather than discovering the contrast regression in a screenshot. Nothing here forbids the
   * kit; `button[uiButton]` is itself a native `<button>` and would keep this assertion true — the second one is what
   * a swap without a surface trips on.
   */
  it('is a native button on the lobby’s own surface, not a kit one on a ground that does not exist yet (#464)', () => {
    expect(lobbyButton().tagName).toBe('BUTTON');
    expect(lobbyButton().hasAttribute('data-variant')).toBe(false);
  });

  it('opens the panel with no alert strip, since the lobby has no round to alert about', () => {
    lobbyButton().click();
    fixture.detectChanges();
    expect(queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.encyclopedia)).not.toBeNull();
    expect(queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.alert)).toBeNull();
  });

  /** No dish behind it here, so nothing is worth keeping half-legible: the lobby's own header must not ghost through. */
  it('covers the lobby completely, rather than leaving its header legible above the panel', () => {
    lobbyButton().click();
    fixture.detectChanges();
    const scrim = root().querySelector<HTMLElement>('ui-scrim');
    expect(scrim?.style.getPropertyValue('--ui-scrim-alpha')).toBe(String(ENCYCLOPEDIA_LOBBY_SCRIM_ALPHA));
  });

  it('closes on Escape and puts focus back on the button that opened it', () => {
    lobbyButton().focus();
    lobbyButton().click();
    fixture.detectChanges();

    pressEscape();
    expect(queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.encyclopedia)).toBeNull();
    expect(document.activeElement).toBe(lobbyButton());
  });

  it('lets the search field own the first Escape while a query is up, and closes on the next', () => {
    lobbyButton().focus();
    lobbyButton().click();
    fixture.detectChanges();
    const field = expectTestId(root(), ENCYCLOPEDIA_TEST_ID.search) as HTMLInputElement;
    field.value = 'mito';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    field.focus();

    pressEscape();
    expect(encyclopedia.query()).toBe('');
    expect(queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.encyclopedia)).not.toBeNull();

    pressEscape();
    expect(queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.encyclopedia)).toBeNull();
  });

  it('closes from the panel’s own Close control too', () => {
    lobbyButton().click();
    fixture.detectChanges();
    expectTestId(root(), ENCYCLOPEDIA_TEST_ID.close).click();
    fixture.detectChanges();
    expect(queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.encyclopedia)).toBeNull();
  });

  /**
   * #449's added "Done when", on the third host. The core clears the query on both of its doors, but nothing
   * *obliges* a host to use one, so the guarantee is the lobby's own and is asserted on the lobby's own close paths.
   * Both are driven with the query **still up**: an Escape would clear it itself and prove nothing about the host.
   */
  describe('a reopen never restores a stale query', () => {
    function openTypeAndClose(close: () => void): void {
      lobbyButton().click();
      fixture.detectChanges();
      const field = expectTestId(root(), ENCYCLOPEDIA_TEST_ID.search) as HTMLInputElement;
      field.value = 'mito';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();
      expect(encyclopedia.query()).toBe('mito');
      close();
      fixture.detectChanges();
      expect(queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.encyclopedia)).toBeNull();
    }

    it('after the panel’s Close, which runs the lobby host’s own close', () => {
      openTypeAndClose(() => expectTestId(root(), ENCYCLOPEDIA_TEST_ID.close).click());
      lobbyButton().click();
      fixture.detectChanges();
      expect(encyclopedia.query()).toBe('');
      expect(expectTestId(root(), ENCYCLOPEDIA_TEST_ID.search)).toHaveProperty('value', '');
    });

    /**
     * The lobby's own Escape, which is the host's second close path. It is pressed from a control **outside the
     * search field** — the panel's Close — so the field does not consume it first: that is what leaves the query
     * still up at the moment the host closes, which is the case worth asserting.
     */
    it('after the lobby’s own Escape, pressed from outside the field so nothing consumes it', () => {
      openTypeAndClose(() => {
        expectTestId(root(), ENCYCLOPEDIA_TEST_ID.close).focus();
        pressEscape();
      });
      lobbyButton().click();
      fixture.detectChanges();
      expect(encyclopedia.query()).toBe('');
    });
  });
});
