import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TraitId } from '@evolution/shared';
import { HUD_OVERLAY, HudStateService } from './hud-state.service';

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
});
