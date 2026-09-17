// The encyclopedia over the lobby (docs/testing/tiers-and-builders.md §2.2), which is acceptance U11 at the client
// tier: the lobby header's button opens the panel with no alert strip, and Escape closes it back to that button.
//
// The lobby is the host here, so it is the lobby's Escape that closes (§11.5), and it is the kit focus trap that puts
// focus back. Outside a room there is no `game_state`, so every value on the page comes from `DEFAULT_BALANCE`.

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppComponent } from './app.component';
import { expectTestId, queryByTestId } from '../testing/test-id-query';
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

  it('opens the panel with no alert strip, since the lobby has no round to alert about', () => {
    lobbyButton().click();
    fixture.detectChanges();
    expect(queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.encyclopedia)).not.toBeNull();
    expect(queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.alert)).toBeNull();
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
});
