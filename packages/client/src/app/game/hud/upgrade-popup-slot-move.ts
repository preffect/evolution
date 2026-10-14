// A popup's move to another slot while it is up (docs/ui/overlays.md §3.8, ticket #861). `upgradePopupSlotFor` answers
// a slot afresh each frame, and its placement can change under a popup that is up: most visibly, the picker opens over
// a big cell while a form popup hangs below it, and the popup has to go to the pinned slot near the top. Rather than
// jump across the cell, the host is held where it was while it fades out over `UPGRADE_POPUP_MOVE_FADE_MS`, then takes
// the slot it should be in by then and fades back in there. Within a placement the slot is followed at once: its offset
// eases with the camera. A popup's entrance is exempt: it is still finding its slot from its measured height, and is
// fading in anyway. The fades are the stylesheet's (`.moving`); this decides only where the host is held, and when.

import { computed, signal } from '@angular/core';
import type { CancelDeferredCall, Scheduler } from '@evolution/shared';
import type { UpgradePopupSlot } from './format/upgrade-popup-slot';
import { UPGRADE_POPUP_KIND, type UpgradePopup } from './format/upgrade-popup-kinds';
import { FORM_POPUP_IN_MS, UPGRADE_POPUP_IN_MS, UPGRADE_POPUP_MOVE_FADE_MS } from './upgrade-popup-constants';

/** Each popup's entrance, during which a change of slot is it settling, not moving. */
function entranceMsOf(popup: UpgradePopup): number {
  return popup.kind === UPGRADE_POPUP_KIND.upgrade ? UPGRADE_POPUP_IN_MS : FORM_POPUP_IN_MS;
}

export class UpgradePopupSlotMove {
  private readonly scheduler: Scheduler;
  private readonly heldSlot = signal<UpgradePopupSlot | null>(null);
  /** The popup followed, by key; a new one starts over. */
  private popupKey: string | null = null;
  /** The slot the host is in: the last one followed, or the one it is held in. */
  private shownSlot: UpgradePopupSlot | null = null;
  /** The newest slot answered, which the host takes when its fade out ends. */
  private latestSlot: UpgradePopupSlot | null = null;
  private isEntering = false;
  /** The end of the entrance or of the fade out, whichever is pending. */
  private cancelPending: CancelDeferredCall | null = null;

  /** True while the host fades out of its old slot: the stylesheet's `.moving`. */
  readonly isFadingOut = computed(() => this.heldSlot() !== null);

  constructor(scheduler: Scheduler) {
    this.scheduler = scheduler;
  }

  /** The slot to draw the host in: `slot`, the one answered now, unless the host is held in its old one. */
  slotToShow(slot: UpgradePopupSlot): UpgradePopupSlot {
    return this.heldSlot() ?? slot;
  }

  /** Called with the popup up and the slot answered for it, whenever either changes. */
  follow(popup: UpgradePopup | null, slot: UpgradePopupSlot): void {
    this.latestSlot = slot;
    const key = popup?.key ?? null;
    if (key !== this.popupKey) {
      this.startOver(popup, slot);
      return;
    }
    if (this.heldSlot() !== null) return;
    if (popup === null || this.isEntering || slot.placement === this.shownSlot?.placement) {
      this.shownSlot = slot;
      return;
    }
    this.heldSlot.set(this.shownSlot);
    this.cancelPending = this.scheduler.after(UPGRADE_POPUP_MOVE_FADE_MS, () => this.arrive());
  }

  /** Stops whatever is pending: the host is being taken down. */
  stop(): void {
    this.cancelPending?.();
    this.cancelPending = null;
  }

  private startOver(popup: UpgradePopup | null, slot: UpgradePopupSlot): void {
    this.stop();
    this.heldSlot.set(null);
    this.popupKey = popup?.key ?? null;
    this.shownSlot = slot;
    this.isEntering = popup !== null;
    if (popup !== null) this.cancelPending = this.scheduler.after(entranceMsOf(popup), () => this.endEntrance());
  }

  private endEntrance(): void {
    this.cancelPending = null;
    this.isEntering = false;
  }

  /** The fade out is over: the host takes the newest slot and fades back in there. */
  private arrive(): void {
    this.cancelPending = null;
    this.shownSlot = this.latestSlot;
    this.heldSlot.set(null);
  }
}
