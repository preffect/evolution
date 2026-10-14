// The upgrade and form popups (docs/ui/overlays.md §3.8, #783): the trait just gained, its tier and its effect lines,
// centred over the own cell, clear of the exclusion box, the cap orbit and the cell's cues (docs/ui/layout.md §1):
// above them where it fits, below the cell where it does not (`upgradePopupSlotFor`, ticket #840), held unseen with its
// life and animations stopped while the picker's band is there (ticket #863); while dead, under the death overlay's
// text instead. A popup whose slot changes while it is up fades across (`UpgradePopupSlotMove`,
// ticket #861). An upgrade
// popup pops in, holds and rises as it fades; a form popup is larger, under a `NEW FORM` kicker, overshoots in with a
// flaring glow and one expanding ring in the seat colour, holds about five seconds and adds its real-life line.
// A giant swallowed raises the giant popup, drawn as a form popup under a `GIANT ENGULFED` kicker: the giant's name,
// the DNA it paid and its real-life line (docs/ecology/giants.md §3.5.8). Under reduced motion all of them only fade.
// It decides nothing: `UpgradePopupService` says which popup is up and what it says. It is read, never pressed: no
// pointer, no focus, a polite live region.

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  untracked,
  type OnInit,
} from '@angular/core';
import { SCHEDULER } from '../clock-provider';
import { HUD_TEST_ID } from '../test-ids/hud-test-ids';
import { ElementSizeTracker } from '../../ui-kit/element-size';
import { UiEffectMarkComponent } from '../../ui-kit/ui-effect-mark.component';
import type { ViewportPx } from '../render/camera';
import { paletteFor } from '../render/palette';
import { GameStateService } from '../state/game-state.service';
import { UPGRADE_POPUP_KIND, type UpgradePopupKind } from './format/upgrade-popup-kinds';
import { UPGRADE_POPUP_PLACEMENT, upgradePopupSlotFor } from './format/upgrade-popup-slot';
import { UpgradePopupSlotMove } from './upgrade-popup-slot-move';
import { UpgradePopupService } from './upgrade-popup.service';

/** A seat the room has not assigned yet draws in the first seat's colour. */
const UNASSIGNED_AVATAR_INDEX = 0;

/** Before the HUD shell has measured its box: nothing fits on it, so the slot answers the pinned or held one. */
const UNMEASURED_VIEWPORT: ViewportPx = { width: 0, height: 0 };

/** Each kind's test id: a giant popup is drawn as a form popup, but tested as itself. */
const POPUP_TEST_ID: Readonly<Record<UpgradePopupKind, string>> = {
  [UPGRADE_POPUP_KIND.upgrade]: HUD_TEST_ID.upgradePopup,
  [UPGRADE_POPUP_KIND.form]: HUD_TEST_ID.formPopup,
  [UPGRADE_POPUP_KIND.giant]: HUD_TEST_ID.giantPopup,
};

@Component({
  selector: 'app-upgrade-popup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiEffectMarkComponent],
  styleUrl: './upgrade-popup.component.css',
  host: {
    '[style.--popup-seat-colour]': 'seatColour()',
    '[style.--popup-offset]': "shownSlot().offsetPx + 'px'",
    '[attr.data-placement]': 'shownSlot().placement',
    '[class.moving]': 'slotMove.isFadingOut()',
    '[class.held]': 'isLifeHeld()',
  },
  template: `
    <div class="live" role="status" aria-live="polite">
      <!-- A list of at most one, keyed per popup, so the next one is a new element and replays its animation. -->
      @for (popup of shown(); track popup.key) {
        <div
          class="popup"
          [class.form]="popup.kind !== kind.upgrade"
          [attr.data-testid]="popupTestId[popup.kind]"
          [attr.data-trait-id]="popup.traitId"
          [attr.data-giant-species]="popup.giantSpecies"
        >
          @if (popup.kicker !== null) {
            <p class="kicker">{{ popup.kicker }}</p>
          }
          <p class="title">{{ popup.title }}</p>
          @for (line of popup.effects; track $index) {
            <p class="effect"><ui-effect-mark [effect]="popup.effectTones[$index] ?? null" />{{ line }}</p>
          }
          @if (popup.realLifeLine !== null) {
            <p class="real-life">{{ popup.realLifeLine }}</p>
          }
        </div>
      }
    </div>
  `,
})
export class UpgradePopupComponent implements OnInit {
  private readonly gameState = inject(GameStateService);
  private readonly popups = inject(UpgradePopupService);
  private readonly current = this.popups.current;
  /** The host's own box: its height is the popup's, with a form popup's glow margins, as laid out. */
  private readonly hostSize = new ElementSizeTracker(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement);
  /** Holds the host in its old slot while it fades out of it, when the slot changes under a popup that is up. */
  protected readonly slotMove = new UpgradePopupSlotMove(inject(SCHEDULER));

  /** The HUD's box, which the slot is centred in. */
  readonly viewport = input<ViewportPx>(UNMEASURED_VIEWPORT);

  protected readonly popupTestId = POPUP_TEST_ID;
  protected readonly kind = UPGRADE_POPUP_KIND;
  /** Above the cell's cues, below the cell, or under the death text, and how far from the centre. */
  protected readonly slot = computed(() => {
    const progress = this.gameState.ownProgress();
    return upgradePopupSlotFor({
      lifeState: progress?.lifeState ?? null,
      viewport: this.viewport(),
      ownCellRadiusWu: this.gameState.ownCell()?.radius ?? null,
      popupHeightPx: this.hostSize.size().heightPx,
      isPickerOpen: (progress?.offer ?? null) !== null,
    });
  });
  /** No slot clear of the cues while the picker is open: the popup waits, its life and animations stopped. */
  protected readonly isHeld = computed(() => this.slot().placement === UPGRADE_POPUP_PLACEMENT.held);
  /** Held before its own fade out began: its animations stop with its life; a later one runs out unseen. */
  protected readonly isLifeHeld = computed(() => this.isHeld() && !this.popups.isUpPopupFadingOut());
  /** The slot the host is drawn in: the one answered now, or the old one while the host fades out of it. */
  protected readonly shownSlot = computed(() => this.slotMove.slotToShow(this.slot()));
  protected readonly shown = computed(() => {
    const popup = this.current();
    return popup === null ? [] : [popup];
  });

  /** The own seat's rim colour: the form popup's rim and glow (docs/visual-style/principles-and-palette.md §2). */
  protected readonly seatColour = computed(() => {
    const own = this.gameState.ownPlayerId();
    const avatarIndex = own === null ? undefined : this.gameState.avatarAssignments()[own];
    return paletteFor(avatarIndex ?? UNASSIGNED_AVATAR_INDEX).rim;
  });

  constructor() {
    effect(() => {
      const popup = this.current();
      const slot = this.slot();
      untracked(() => this.slotMove.follow(popup, slot));
    });
    effect(() => {
      const isHeld = this.isHeld();
      untracked(() => this.popups.setUpPopupHeld(isHeld));
    });
    inject(DestroyRef).onDestroy(() => {
      this.slotMove.stop();
      this.popups.setUpPopupHeld(false);
    });
  }

  ngOnInit(): void {
    this.hostSize.start();
  }
}
