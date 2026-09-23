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
import { PANEL_TOP, TEXT_LABEL } from './game/render/constants/colours';
import { UI_SCALE_VARIABLE } from './ui-kit/format/ui-css-variables';
import { UI_BUTTON_VARIANT } from './ui-kit/ui-button.component';
import { contrastRatio } from '../testing/colour-difference';

/** principles-and-palette.md §2: body text against its own ground. */
const TEXT_CONTRAST_MIN = 4.5;

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
   * The guard #449 left for this ticket (#464, decision #595 option A): the control is a kit `quiet` button, and it
   * sits on the lobby's kit surface, the layer that publishes the dark panel ground a kit label is made for. A
   * `uiButton` on the old white page was the contrast regression that guard existed to stop, so both halves are
   * pinned together, with the label's contrast on that ground (principles-and-palette.md §2's 4.5:1 text bar).
   */
  it('is a kit quiet button on the lobby surface, and its label clears 4.5:1 on that ground', () => {
    expect(lobbyButton().tagName).toBe('BUTTON');
    expect(lobbyButton().getAttribute('data-variant')).toBe(UI_BUTTON_VARIANT.quiet);
    const surface = lobbyButton().closest<HTMLElement>('.lobby');
    expect(surface?.style.getPropertyValue(UI_SCALE_VARIABLE)).not.toBe('');
    expect(surface?.style.getPropertyValue('--ui-panel-top')).toBe(PANEL_TOP);
    expect(contrastRatio(TEXT_LABEL, PANEL_TOP)).toBeGreaterThanOrEqual(TEXT_CONTRAST_MIN);
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
