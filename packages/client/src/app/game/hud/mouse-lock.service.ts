// The HUD's side of the mouse lock (docs/ui/input-and-onboarding.md §4.1, #794): the menu toggle, remembered per browser,
// whether an overlay needs the real cursor, and where the in-game cursor is drawn while the pointer is locked. The
// input layer's `pointer-lock-input.ts` reads the first two and writes the third through the game host.

import { Injectable, computed, inject, signal } from '@angular/core';
import { ROUND_PHASE } from '@evolution/shared';
import { GameStateService } from '../state/game-state.service';
import type { CanvasPoint } from '../input/input-state';
import { MOUSE_LOCK_OFF_FLAG, MOUSE_LOCK_STORAGE_KEY } from './hud-constants';
import { HUD_OVERLAY, HudStateService } from './hud-state.service';

/** The overlays with controls a player has to point at: the lock is handed back while one is up. */
const CURSOR_OVERLAYS: ReadonlySet<string> = new Set([HUD_OVERLAY.menu, HUD_OVERLAY.encyclopedia]);

/** On unless this browser remembered "off"; a browser that refuses storage starts on. */
function readIsEnabled(): boolean {
  try {
    return localStorage.getItem(MOUSE_LOCK_STORAGE_KEY) !== MOUSE_LOCK_OFF_FLAG;
  } catch {
    return true;
  }
}

function writeIsEnabled(isEnabled: boolean): void {
  try {
    if (isEnabled) localStorage.removeItem(MOUSE_LOCK_STORAGE_KEY);
    else localStorage.setItem(MOUSE_LOCK_STORAGE_KEY, MOUSE_LOCK_OFF_FLAG);
  } catch {
    // localStorage unavailable (private mode, sandbox): the choice holds for this session only.
  }
}

@Injectable({ providedIn: 'root' })
export class MouseLockService {
  private readonly hudState = inject(HudStateService);
  private readonly gameState = inject(GameStateService);
  private readonly isEnabledValue = signal(readIsEnabled());
  private readonly cursorPointValue = signal<CanvasPoint | null>(null);

  /** The menu's `Mouse lock` toggle; off means a click outside the window loses focus, as before #794. */
  readonly isEnabled = this.isEnabledValue.asReadonly();

  /** The virtual pointer in canvas px while the pointer is locked; `null` hides the in-game cursor. */
  readonly cursorPoint = this.cursorPointValue.asReadonly();

  /**
   * The menu, the encyclopedia and the results have buttons to point at. The trait picker does not count: the lock
   * stays through it (§4.1), and the death overlay has nothing to click.
   */
  readonly isCursorNeeded = computed(
    () => CURSOR_OVERLAYS.has(this.hudState.openOverlay()) || this.gameState.roundPhase() === ROUND_PHASE.results,
  );

  toggle(): void {
    const isEnabled = !this.isEnabledValue();
    this.isEnabledValue.set(isEnabled);
    writeIsEnabled(isEnabled);
  }

  setCursorPoint(point: CanvasPoint | null): void {
    this.cursorPointValue.set(point);
  }

  /** The player left the lock with Escape: the menu opens, as that Escape would have opened it (§4.1). */
  exitedByUser(): void {
    if (!this.hudState.isMenuOpen()) this.hudState.openMenu();
  }
}
