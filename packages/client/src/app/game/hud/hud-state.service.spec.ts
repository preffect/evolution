import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
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
});
