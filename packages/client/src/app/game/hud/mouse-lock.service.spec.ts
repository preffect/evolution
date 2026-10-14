import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUND_PHASE, createTestSnapshot } from '@evolution/shared';
import { MultiplayerService } from '../../services/multiplayer.service';
import { MOUSE_LOCK_OFF_FLAG, MOUSE_LOCK_STORAGE_KEY } from './hud-constants';
import { HUD_OVERLAY, HudStateService } from './hud-state.service';
import { MouseLockService } from './mouse-lock.service';

describe('MouseLockService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('is on by default and remembers off per browser', () => {
    const mouseLock = TestBed.inject(MouseLockService);
    expect(mouseLock.isEnabled()).toBe(true);
    mouseLock.toggle();
    expect(mouseLock.isEnabled()).toBe(false);
    expect(localStorage.getItem(MOUSE_LOCK_STORAGE_KEY)).toBe(MOUSE_LOCK_OFF_FLAG);
    mouseLock.toggle();
    expect(localStorage.getItem(MOUSE_LOCK_STORAGE_KEY)).toBeNull();
  });

  it('starts off in a browser that remembered off', () => {
    localStorage.setItem(MOUSE_LOCK_STORAGE_KEY, MOUSE_LOCK_OFF_FLAG);
    expect(TestBed.inject(MouseLockService).isEnabled()).toBe(false);
  });

  it('starts on and still toggles for the session when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage refused');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage refused');
    });
    const mouseLock = TestBed.inject(MouseLockService);
    expect(mouseLock.isEnabled()).toBe(true);
    expect(() => mouseLock.toggle()).not.toThrow();
    expect(mouseLock.isEnabled()).toBe(false);
  });

  it('wants the real cursor for the menu, the encyclopedia and the results, and not for the full leaderboard', () => {
    const mouseLock = TestBed.inject(MouseLockService);
    const hudState = TestBed.inject(HudStateService);
    expect(mouseLock.isCursorNeeded()).toBe(false);
    hudState.setFullLeaderboardHeld(true);
    expect(mouseLock.isCursorNeeded()).toBe(false);
    hudState.openMenu();
    expect(mouseLock.isCursorNeeded()).toBe(true);
    hudState.openEncyclopedia(null);
    expect(mouseLock.isCursorNeeded()).toBe(true);
    hudState.closeOverlays();
    expect(mouseLock.isCursorNeeded()).toBe(false);
    TestBed.inject(MultiplayerService).snapshot.set(createTestSnapshot({ roundPhase: ROUND_PHASE.results }));
    expect(mouseLock.isCursorNeeded()).toBe(true);
  });

  it('opens the menu when the player leaves the lock with Escape and nothing is open', () => {
    const mouseLock = TestBed.inject(MouseLockService);
    const hudState = TestBed.inject(HudStateService);
    mouseLock.exitedByUser();
    expect(hudState.openOverlay()).toBe(HUD_OVERLAY.menu);
  });

  it('follows the topmost-first order: an Escape out of the lock closes the full leaderboard and opens no menu', () => {
    const mouseLock = TestBed.inject(MouseLockService);
    const hudState = TestBed.inject(HudStateService);
    hudState.toggleFullLeaderboard();
    mouseLock.exitedByUser();
    expect(hudState.openOverlay()).toBe(HUD_OVERLAY.none);
  });

  it('leaves a menu the key already opened open, when the browser then also drops the lock', () => {
    const mouseLock = TestBed.inject(MouseLockService);
    const hudState = TestBed.inject(HudStateService);
    hudState.pressMenuKey();
    mouseLock.exitedByUser();
    expect(hudState.openOverlay()).toBe(HUD_OVERLAY.menu);
  });
});
