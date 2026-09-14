// The HUD's writable UI signals (docs/ui/components-and-constants.md §7): state the player's own actions set, which no
// snapshot can answer. Nothing derived lives here — that is `GameStateService` — and nothing here
// reaches the wire.
//
// Only `openOverlay` is declared: the chrome (#185) is its first writer. `previewTraitId` (#188)
// and the onboarding `reticleVisible` flag (#190) join it when those slices land.

import { Injectable, computed, signal } from '@angular/core';
import type { ValueOf } from '@evolution/shared';

/**
 * The topmost open overlay. The full leaderboard IS an overlay, so there is no separate expanded
 * flag; `menu` is #189's and nothing sets it yet.
 */
export const HUD_OVERLAY = { none: 'none', menu: 'menu', leaderboard: 'leaderboard' } as const;
export type HudOverlay = ValueOf<typeof HUD_OVERLAY>;

@Injectable({ providedIn: 'root' })
export class HudStateService {
  private readonly openOverlayValue = signal<HudOverlay>(HUD_OVERLAY.none);

  readonly openOverlay = this.openOverlayValue.asReadonly();

  /** The full leaderboard is open (docs/ui/hud.md §3.1.1): Tab is held, or the header was clicked. */
  readonly isFullLeaderboardOpen = computed(() => this.openOverlayValue() === HUD_OVERLAY.leaderboard);

  /**
   * Tab held / released (docs/ui/input-and-onboarding.md §4), fed from the input seam's one keyboard listener. A release
   * only closes the leaderboard: an overlay opened over it in the meantime keeps its place.
   */
  setFullLeaderboardHeld(isHeld: boolean): void {
    if (isHeld) {
      this.openOverlayValue.set(HUD_OVERLAY.leaderboard);
      return;
    }
    if (this.openOverlayValue() === HUD_OVERLAY.leaderboard) this.openOverlayValue.set(HUD_OVERLAY.none);
  }

  /** The leaderboard header clicked: the pointer's equivalent of holding Tab (docs/ui/input-and-onboarding.md §4). */
  toggleFullLeaderboard(): void {
    this.setFullLeaderboardHeld(!this.isFullLeaderboardOpen());
  }
}
