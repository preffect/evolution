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
import { MultiplayerService } from './services/multiplayer.service';

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
   * **A deliberate tripwire, not a discriminator. If you are reading this because it went red: that is what it is
   * for, nothing is broken, and the answer is ticket #464 — go and read it before changing this line.**
   *
   * What it asserts is blunt on purpose: `lobby-encyclopedia` is a `<button>` with no `data-variant`, and
   * `UiButtonComponent` stamps `data-variant` unconditionally (`'[attr.data-variant]': 'variant()'`, with a
   * `secondary` default). So **any** `uiButton` here turns this case red — the naive swap and the correct
   * surface-first one alike. It cannot tell them apart and does not try to.
   *
   * Why blunt and not clever. The discriminating version would have to detect a kit ground above the control, which
   * means guessing where #464 puts the surface; `UiSurfaceDirective`'s own header says a surface belongs on a
   * full-viewport layer and never on a header, so a guess written today would likely be wrong tomorrow — and a guard
   * that is wrong again teaches the next person a second false lesson. An honestly-named tripwire keeps working.
   *
   * Why there is a tripwire at all. `layout.md` §2 puts this control in a table whose own rule is "every control is a
   * native `<input>`, `<select>` or `<button>`", and components-and-constants.md §10 says the lobby screens move onto
   * the kit by their own ticket. Until that lands, dressing this one control in `uiButton` makes it **worse**: a kit
   * `secondary` button is `color: var(--ui-text)` over a `UI_SECONDARY_FILL_ALPHA` fill of the same colour — a light
   * label for the dark panel gradient — and the lobby around it is `#1a1a1a` on white, where graphics-qa measured
   * that fill at **1.09:1**. The surface has to come first, and this case exists to make sure whoever does it has
   * read why (#449, PR #463).
   */
  it('refuses any uiButton on this control, on purpose, until ticket #464 gives the lobby a kit ground', () => {
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
     * **The round starting underneath the reader**, which is the close path nobody deliberately takes and the one
     * #449's review found leaking (both the panel and the query). Any non-host gets it the moment the host presses
     * Start, and they cannot have closed it themselves: the panel is modal and focus-trapped. The lobby `@else`
     * unmounts it without `closeEncyclopedia()` ever running, so before the fix the flag survived the round and the
     * panel came back unbidden, showing a search from before it.
     */
    it('after a round started underneath it, which is the close path nobody chooses', () => {
      const multiplayer = TestBed.inject(MultiplayerService);
      openTypeAndClose(() => multiplayer.phase.set('in-game'));

      multiplayer.phase.set('lobby');
      fixture.detectChanges();
      expect(queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.encyclopedia)).toBeNull();
      expect(encyclopedia.query()).toBe('');

      lobbyButton().click();
      fixture.detectChanges();
      expect(encyclopedia.query()).toBe('');
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
