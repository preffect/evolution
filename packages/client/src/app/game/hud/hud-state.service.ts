// The HUD's writable UI signals (docs/ui/components-and-constants.md §7): state the player's own actions set, which no
// snapshot can answer. Nothing derived lives here — that is `GameStateService` — and nothing here
// reaches the wire.
//
// `openOverlay` is the chrome's (#185) and the menu's (#371); `previewTraitId` and the card pick are the picker's
// (#188). The encyclopedia's request (`encyclopediaReturnTo`, `encyclopediaEntryId`) is set here by the menu and read
// by the encyclopedia shell (#372). The onboarding `reticleVisible` flag is
// derived, not set, so it lives on `OnboardingService` (#530).

import { Injectable, computed, signal } from '@angular/core';
import type { TraitId, ValueOf } from '@evolution/shared';

/** The topmost open overlay. The full leaderboard IS an overlay, so there is no separate expanded flag. */
export const HUD_OVERLAY = {
  none: 'none',
  menu: 'menu',
  leaderboard: 'leaderboard',
  encyclopedia: 'encyclopedia',
} as const;
export type HudOverlay = ValueOf<typeof HUD_OVERLAY>;

/** Where the encyclopedia's Escape goes (docs/ui/encyclopedia.md §11.1): back to the menu, or to the game. */
export const ENCYCLOPEDIA_RETURN = { menu: 'menu', game: 'game' } as const;
export type EncyclopediaReturn = ValueOf<typeof ENCYCLOPEDIA_RETURN>;

/** Queues a card press for the offer on screen; the input seam's own pick policy decides its fate. */
export type TraitCardPick = (cardIndex: number) => void;

@Injectable({ providedIn: 'root' })
export class HudStateService {
  private readonly openOverlayValue = signal<HudOverlay>(HUD_OVERLAY.none);
  private readonly previewTraitIdValue = signal<TraitId | null>(null);
  private readonly isFullLeaderboardPinnedValue = signal(false);
  private readonly encyclopediaReturnToValue = signal<EncyclopediaReturn>(ENCYCLOPEDIA_RETURN.game);
  private readonly encyclopediaEntryIdValue = signal<string | null>(null);
  private readonly menuReturnFocusTestIdValue = signal<string | null>(null);
  /** Set by the game host once the input seam exists; `null` outside a room. */
  private traitCardPick: TraitCardPick | null = null;

  /**
   * The highlighted card's trait (docs/ui/overlays.md §3.2): hover and focus write it, the renderer draws its
   * ghost on the own cell and the ladder hides the matching orbit ghost. `null` while no card is highlighted.
   */
  readonly previewTraitId = this.previewTraitIdValue.asReadonly();

  readonly openOverlay = this.openOverlayValue.asReadonly();

  /** Where the open encyclopedia's Escape returns to (docs/ui/encyclopedia.md §11.1). */
  readonly encyclopediaReturnTo = this.encyclopediaReturnToValue.asReadonly();

  /** The entry the encyclopedia was asked to open at (`trait:<traitId>`); `null` for its last location. */
  readonly encyclopediaEntryId = this.encyclopediaEntryIdValue.asReadonly();

  /**
   * The menu control that opened the encyclopedia, which takes focus when its Escape brings the menu back
   * (docs/ui/encyclopedia.md §11.1); `null` when the menu opens fresh, where `Return to game` takes it.
   */
  readonly menuReturnFocusTestId = this.menuReturnFocusTestIdValue.asReadonly();

  /** The full leaderboard is open (docs/ui/hud.md §3.1.1): Tab is held, or the header was clicked. */
  readonly isFullLeaderboardOpen = computed(() => this.openOverlayValue() === HUD_OVERLAY.leaderboard);

  /** The header opened the full list and no Tab hold has taken it over since: its hint says how it closes. */
  readonly isFullLeaderboardPinned = computed(
    () => this.isFullLeaderboardOpen() && this.isFullLeaderboardPinnedValue(),
  );

  /** The Escape menu is open (docs/ui/overlays.md §3.5). */
  readonly isMenuOpen = computed(() => this.openOverlayValue() === HUD_OVERLAY.menu);

  /**
   * Tab held / released (docs/ui/input-and-onboarding.md §4), fed from the input seam's one keyboard listener. A release
   * only closes the leaderboard: an overlay opened over it in the meantime keeps its place.
   */
  setFullLeaderboardHeld(isHeld: boolean): void {
    this.isFullLeaderboardPinnedValue.set(false);
    if (isHeld) {
      this.openOverlayValue.set(HUD_OVERLAY.leaderboard);
      return;
    }
    if (this.openOverlayValue() === HUD_OVERLAY.leaderboard) this.openOverlayValue.set(HUD_OVERLAY.none);
  }

  /** The leaderboard header clicked: the pointer's equivalent of holding Tab (docs/ui/input-and-onboarding.md §4). */
  toggleFullLeaderboard(): void {
    const isOpening = !this.isFullLeaderboardOpen();
    this.setFullLeaderboardHeld(isOpening);
    this.isFullLeaderboardPinnedValue.set(isOpening);
  }

  /**
   * Escape nothing else consumed (docs/ui/overlays.md §3.5): closes the topmost overlay — the full leaderboard, or the
   * encyclopedia back to where it was opened from, or the menu — and, with none open, opens the menu.
   */
  pressMenuKey(): void {
    const open = this.openOverlayValue();
    if (open === HUD_OVERLAY.none) {
      this.openMenu();
      return;
    }
    const isEncyclopediaOverMenu =
      open === HUD_OVERLAY.encyclopedia && this.encyclopediaReturnToValue() === ENCYCLOPEDIA_RETURN.menu;
    if (isEncyclopediaOverMenu) this.openOverlayValue.set(HUD_OVERLAY.menu);
    else this.closeOverlays();
  }

  /** Opens the menu fresh, with focus for `Return to game`. */
  openMenu(): void {
    this.menuReturnFocusTestIdValue.set(null);
    this.openOverlayValue.set(HUD_OVERLAY.menu);
  }

  /** Back to the game: `Return to game`, the alert strip, and leaving the room all close every overlay. */
  closeOverlays(): void {
    this.isFullLeaderboardPinnedValue.set(false);
    this.menuReturnFocusTestIdValue.set(null);
    this.openOverlayValue.set(HUD_OVERLAY.none);
  }

  /**
   * Replaces the open overlay with the encyclopedia (docs/ui/encyclopedia.md §11.1), at `entryId` or, with `null`, at
   * its last location. Opened from the menu, its Escape comes back to the menu with focus on `returnFocusTestId`;
   * from play, to the game. The encyclopedia shell (#372) renders this state.
   */
  openEncyclopedia(entryId: string | null, returnFocusTestId: string | null = null): void {
    const isFromMenu = this.openOverlayValue() === HUD_OVERLAY.menu;
    this.encyclopediaReturnToValue.set(isFromMenu ? ENCYCLOPEDIA_RETURN.menu : ENCYCLOPEDIA_RETURN.game);
    this.encyclopediaEntryIdValue.set(entryId);
    this.menuReturnFocusTestIdValue.set(isFromMenu ? returnFocusTestId : null);
    this.openOverlayValue.set(HUD_OVERLAY.encyclopedia);
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
