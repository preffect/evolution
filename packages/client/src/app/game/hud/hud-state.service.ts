// The HUD's writable UI signals (docs/ui/components-and-constants.md §7): state the player's own actions set, which no
// snapshot can answer. Nothing derived lives here — that is `GameStateService` — and nothing here
// reaches the wire.
//
// `openOverlay` is the chrome's (#185); `previewTraitId` and the card pick are the picker's (#188). The
// onboarding `reticleVisible` flag (#190) joins them when that slice lands.

import { Injectable, computed, signal } from '@angular/core';
import type { TraitId, ValueOf } from '@evolution/shared';

/**
 * The topmost open overlay. The full leaderboard IS an overlay, so there is no separate expanded
 * flag; `menu` is #189's and nothing sets it yet.
 */
export const HUD_OVERLAY = { none: 'none', menu: 'menu', leaderboard: 'leaderboard' } as const;
export type HudOverlay = ValueOf<typeof HUD_OVERLAY>;

/** Queues a card press for the offer on screen; the input seam's own pick policy decides its fate. */
export type TraitCardPick = (cardIndex: number) => void;

@Injectable({ providedIn: 'root' })
export class HudStateService {
  private readonly openOverlayValue = signal<HudOverlay>(HUD_OVERLAY.none);
  private readonly previewTraitIdValue = signal<TraitId | null>(null);
  /** Set by the game host once the input seam exists; `null` outside a room. */
  private traitCardPick: TraitCardPick | null = null;

  /**
   * The highlighted card's trait (docs/ui/overlays.md §3.2): hover and focus write it, the renderer draws its
   * ghost on the own cell and the ladder hides the matching orbit ghost. `null` while no card is highlighted.
   */
  readonly previewTraitId = this.previewTraitIdValue.asReadonly();

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

  /** A card highlighted (hover, focus) or let go (`null`). */
  setPreviewTraitId(traitId: TraitId | null): void {
    this.previewTraitIdValue.set(traitId);
  }

  /** The input seam's pick for this room, or `null` when the room goes; a room's HUD clicks go through it. */
  setTraitCardPick(pick: TraitCardPick | null): void {
    this.traitCardPick = pick;
  }

  /** A card clicked, or Enter / Space on its focused control (docs/ui/overlays.md §3.2): the same path as the `1` `2` `3` keys. */
  pickTraitCard(cardIndex: number): void {
    this.traitCardPick?.(cardIndex);
  }
}
