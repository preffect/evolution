import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TraitId } from '@evolution/shared';
import { ENCYCLOPEDIA_RETURN, HUD_OVERLAY, HudStateService } from './hud-state.service';

describe('HudStateService', () => {
  let hudState: HudStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    hudState = TestBed.inject(HudStateService);
  });

  it('starts with no overlay open', () => {
    expect(hudState.openOverlay()).toBe(HUD_OVERLAY.none);
    expect(hudState.isFullLeaderboardOpen()).toBe(false);
  });

  it('opens the full leaderboard while Tab is held and closes it on the release', () => {
    hudState.setFullLeaderboardHeld(true);
    expect(hudState.openOverlay()).toBe(HUD_OVERLAY.leaderboard);
    expect(hudState.isFullLeaderboardOpen()).toBe(true);

    hudState.setFullLeaderboardHeld(false);
    expect(hudState.openOverlay()).toBe(HUD_OVERLAY.none);
  });

  it('toggles on the header click, the pointer’s equivalent of the hold', () => {
    hudState.toggleFullLeaderboard();
    expect(hudState.isFullLeaderboardOpen()).toBe(true);
    hudState.toggleFullLeaderboard();
    expect(hudState.isFullLeaderboardOpen()).toBe(false);
  });

  it('marks a header-opened full list as pinned until it closes or a Tab hold takes it over', () => {
    hudState.toggleFullLeaderboard();
    expect(hudState.isFullLeaderboardPinned()).toBe(true);
    hudState.toggleFullLeaderboard();
    expect(hudState.isFullLeaderboardPinned()).toBe(false);

    hudState.toggleFullLeaderboard();
    hudState.setFullLeaderboardHeld(true);
    expect(hudState.isFullLeaderboardPinned()).toBe(false);
    hudState.setFullLeaderboardHeld(false);
    expect(hudState.isFullLeaderboardOpen()).toBe(false);

    hudState.setFullLeaderboardHeld(true);
    expect(hudState.isFullLeaderboardPinned()).toBe(false);
  });

  it('leaves another overlay alone when the Tab release arrives', () => {
    hudState.setFullLeaderboardHeld(true);
    hudState.setFullLeaderboardHeld(false);
    expect(hudState.openOverlay()).toBe(HUD_OVERLAY.none);
    // A release with nothing of ours open must not clear what something else opened.
    hudState.setFullLeaderboardHeld(false);
    expect(hudState.openOverlay()).toBe(HUD_OVERLAY.none);
  });

  it('holds the previewed trait a card writes, and lets it go', () => {
    expect(hudState.previewTraitId()).toBeNull();
    hudState.setPreviewTraitId('cilia' as TraitId);
    expect(hudState.previewTraitId()).toBe('cilia');
    hudState.setPreviewTraitId(null);
    expect(hudState.previewTraitId()).toBeNull();
  });

  it('routes a card pick to the room’s input seam, and drops it with no room', () => {
    hudState.pickTraitCard(1);
    const pick = vi.fn();
    hudState.setTraitCardPick(pick);
    hudState.pickTraitCard(2);
    expect(pick).toHaveBeenCalledExactlyOnceWith(2);
    hudState.setTraitCardPick(null);
    hudState.pickTraitCard(0);
    expect(pick).toHaveBeenCalledTimes(1);
  });

  describe('Escape and the menu (docs/ui/overlays.md §3.5)', () => {
    it('opens the menu with nothing open, and closes it on the next press', () => {
      hudState.pressMenuKey();
      expect(hudState.openOverlay()).toBe(HUD_OVERLAY.menu);
      expect(hudState.isMenuOpen()).toBe(true);
      hudState.pressMenuKey();
      expect(hudState.openOverlay()).toBe(HUD_OVERLAY.none);
    });

    it('closes a held full leaderboard first, because it is the topmost overlay', () => {
      hudState.setFullLeaderboardHeld(true);
      hudState.pressMenuKey();
      expect(hudState.openOverlay()).toBe(HUD_OVERLAY.none);
    });

    it('replaces the menu with the encyclopedia, whose Escape comes back to the control that opened it', () => {
      hudState.openMenu();
      hudState.openEncyclopedia('trait:nucleoid', 'menu-trait-nucleoid');
      expect(hudState.openOverlay()).toBe(HUD_OVERLAY.encyclopedia);
      expect(hudState.encyclopediaReturnTo()).toBe(ENCYCLOPEDIA_RETURN.menu);
      expect(hudState.encyclopediaEntryId()).toBe('trait:nucleoid');

      hudState.pressMenuKey();
      expect(hudState.openOverlay()).toBe(HUD_OVERLAY.menu);
      expect(hudState.menuReturnFocusTestId()).toBe('menu-trait-nucleoid');

      hudState.pressMenuKey();
      expect(hudState.openOverlay()).toBe(HUD_OVERLAY.none);
      expect(hudState.menuReturnFocusTestId()).toBeNull();
    });

    it('sends the encyclopedia opened from play back to the game, with no menu focus to return', () => {
      hudState.openEncyclopedia(null, 'menu-encyclopedia');
      expect(hudState.encyclopediaReturnTo()).toBe(ENCYCLOPEDIA_RETURN.game);
      expect(hudState.encyclopediaEntryId()).toBeNull();
      expect(hudState.menuReturnFocusTestId()).toBeNull();
      hudState.pressMenuKey();
      expect(hudState.openOverlay()).toBe(HUD_OVERLAY.none);
    });

    it('opens the menu fresh, forgetting a focus return that belonged to an earlier encyclopedia visit', () => {
      hudState.openMenu();
      hudState.openEncyclopedia(null, 'menu-encyclopedia');
      hudState.pressMenuKey();
      hudState.closeOverlays();
      hudState.openMenu();
      expect(hudState.menuReturnFocusTestId()).toBeNull();
    });
  });
});
