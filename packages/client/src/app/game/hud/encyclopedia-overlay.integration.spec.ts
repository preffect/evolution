// The encyclopedia over the wired HUD (docs/testing/tiers-and-builders.md §2.2), which is acceptance U8 at the client
// tier: Escape opens the menu, `Encyclopedia` replaces it with the panel on the first listed category, and Escape
// comes back to the menu and then out to the game. It pins the crossings the unit specs cannot see — the HUD's
// overlay order, the alert strip the shell projects into the panel's header, and the chrome standing down under it.
//
// **U8 asserts the first listed category, not `basics` by name** (docs/ui/encyclopedia.md §11.1): §11.5 forbids
// showing an empty category, so the open falls to the first category the rail lists. The assertion below is written
// that way on purpose: `basics` has entries since #361, and naming it here would say nothing about the rule.

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, createTestPlayerProgressView, createTestSnapshot } from '@evolution/shared';
import { TEST_OWN_PLAYER_ID, createTestCellView } from '../../../testing/builders';
import { expectTestId, queryByTestId } from '../../../testing/test-id-query';
import { MultiplayerService } from '../../services/multiplayer.service';
import { EncyclopediaStateService, LISTED_ENCYCLOPEDIA_CATEGORIES } from '../encyclopedia/encyclopedia-state.service';
import { ENCYCLOPEDIA_TEST_ID, encyclopediaCategoryTestId, encyclopediaRowTestId } from '../encyclopedia/test-ids';
import { entriesIn } from '../encyclopedia/registry';
import { HUD_OVERLAY, HudStateService } from './hud-state.service';
import { HudComponent } from './hud.component';
import { HUD_TEST_ID } from './test-ids';

const SNAPSHOT = createTestSnapshot({
  cells: [createTestCellView({ playerId: TEST_OWN_PLAYER_ID, x: 0, y: 0, radius: 4 })],
  ownProgress: createTestPlayerProgressView({ playerId: TEST_OWN_PLAYER_ID }),
});

describe('the encyclopedia over the wired HUD (acceptance U8)', () => {
  let hud: ComponentFixture<HudComponent>;
  let hudState: HudStateService;
  let encyclopedia: EncyclopediaStateService;
  let canvasHost: HTMLElement;

  function render(): void {
    hud.detectChanges();
  }

  function query(testId: string): HTMLElement | null {
    return queryByTestId(hud.nativeElement as HTMLElement, testId);
  }

  function openFromMenu(): void {
    hudState.pressMenuKey();
    render();
    expectTestId(hud.nativeElement as HTMLElement, HUD_TEST_ID.menuEncyclopedia).click();
    render();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HudComponent] });
    hudState = TestBed.inject(HudStateService);
    encyclopedia = TestBed.inject(EncyclopediaStateService);
    const multiplayer = TestBed.inject(MultiplayerService);
    multiplayer.playerId.set(TEST_OWN_PLAYER_ID);
    multiplayer.balance.set(DEFAULT_BALANCE);
    multiplayer.snapshot.set(SNAPSHOT);
    // The element §11.1 sends focus back to, in the document before the panel can look for it.
    canvasHost = document.body.appendChild(document.createElement('div'));
    canvasHost.tabIndex = 0;
    canvasHost.setAttribute('data-testid', HUD_TEST_ID.gameHost);
    hud = TestBed.createComponent(HudComponent);
    render();
  });

  afterEach(() => {
    hud.destroy();
    canvasHost.remove();
  });

  it('opens from the menu on the first category the rail lists, with that row selected', () => {
    openFromMenu();
    const first = LISTED_ENCYCLOPEDIA_CATEGORIES[0]!;
    expect(query(ENCYCLOPEDIA_TEST_ID.encyclopedia)).not.toBeNull();
    expect(encyclopedia.location()).toEqual({ category: first, entryId: null, sectionKey: null });
    expect(
      expectTestId(hud.nativeElement as HTMLElement, encyclopediaCategoryTestId(first)).getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('replaces the menu rather than stacking on it, and Escape brings the menu back before the game', () => {
    openFromMenu();
    expect(query(HUD_TEST_ID.menuOverlay)).toBeNull();

    hudState.pressMenuKey();
    render();
    expect(query(ENCYCLOPEDIA_TEST_ID.encyclopedia)).toBeNull();
    expect(query(HUD_TEST_ID.menuOverlay)).not.toBeNull();

    hudState.pressMenuKey();
    render();
    expect(hudState.openOverlay()).toBe(HUD_OVERLAY.none);
    expect(query(HUD_TEST_ID.menuOverlay)).toBeNull();
  });

  it('stands the board and the clock down while it is open, and brings them back on close', () => {
    expect(query(HUD_TEST_ID.leaderboard)).not.toBeNull();
    openFromMenu();
    expect(query(HUD_TEST_ID.leaderboard)).toBeNull();
    expect(query(HUD_TEST_ID.roundClock)).toBeNull();

    hudState.closeOverlays();
    render();
    expect(query(HUD_TEST_ID.leaderboard)).not.toBeNull();
  });

  it('opens straight at the entry the menu asked for, with its row selected in the list', () => {
    const entryId = entriesIn(LISTED_ENCYCLOPEDIA_CATEGORIES[0]!)[0]!.entries[0]!.entryId;
    hudState.openEncyclopedia(entryId);
    render();
    expect(encyclopedia.location().entryId).toBe(entryId);
    expect(
      expectTestId(hud.nativeElement as HTMLElement, encyclopediaRowTestId(entryId)).getAttribute('aria-selected'),
    ).toBe('true');
  });

  /**
   * §11.1's third row: an `H`-in-play close returns "focus on the canvas host". The kit trap would otherwise restore
   * whatever had focus when the panel opened — and on the first `H` of a round that is `<body>`, because the Start
   * button unmounted when the room began. The reader would lose the cursor entirely and the next Tab would restart
   * at the top of the document, which is what #449's review found live.
   */
  it('gives focus to the canvas host when it closes to the game, even with nothing focused when it opened', () => {
    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.activeElement).toBe(document.body);

    hudState.openEncyclopedia(null);
    render();
    hudState.pressMenuKey();
    render();

    expect(query(ENCYCLOPEDIA_TEST_ID.encyclopedia)).toBeNull();
    expect(document.activeElement).toBe(canvasHost);
  });

  /** The other return in §11.1 is the menu's own control, so a close **to the menu** must not take the canvas host. */
  it('leaves the canvas host alone when it closes to the menu, which restores its own control', () => {
    openFromMenu();
    hudState.pressMenuKey();
    render();
    expect(query(HUD_TEST_ID.menuOverlay)).not.toBeNull();
    expect(document.activeElement).not.toBe(canvasHost);
  });

  it('keeps the reading position across a close and a reopen, but never a stale query', () => {
    openFromMenu();
    const entryId = entriesIn(LISTED_ENCYCLOPEDIA_CATEGORIES[0]!)[0]!.entries[0]!.entryId;
    encyclopedia.openEntry(entryId);
    encyclopedia.setQuery('mito');
    render();

    hudState.closeOverlays();
    render();
    openFromMenu();
    expect(encyclopedia.location().entryId).toBe(entryId);
    expect(encyclopedia.query()).toBe('');
  });
});
