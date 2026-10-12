// The upgrade and form popups (docs/ui/overlays.md §3.8, #783): the trait just gained, its tier and its effect lines,
// centred above the own cell, its bottom edge where the picker band's top edge is below it, so it never enters the
// exclusion box or the cap orbit (docs/ui/layout.md §1); while dead, under the death overlay's text instead. An upgrade
// popup pops in, holds and rises as it fades; a form popup is larger, under a `NEW FORM` kicker, overshoots in with a
// flaring glow and one expanding ring in the seat colour, holds about five seconds and adds its real-life line.
// A giant swallowed raises the giant popup, drawn as a form popup under a `GIANT ENGULFED` kicker: the giant's name,
// the DNA it paid and its real-life line (docs/ecology/giants.md §3.5.8). Under reduced motion all of them only fade. It decides nothing: `UpgradePopupService` says which popup is up and what it
// says. It is read, never pressed: no pointer, no focus, a polite live region.

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { HUD_TEST_ID } from '../test-ids/hud-test-ids';
import { UiEffectMarkComponent } from '../../ui-kit/ui-effect-mark.component';
import { paletteFor } from '../render/palette';
import { GameStateService } from '../state/game-state.service';
import { UPGRADE_POPUP_KIND, type UpgradePopupKind } from './format/upgrade-popup-kinds';
import { upgradePopupPlacementFor } from './format/upgrade-popups';
import { UpgradePopupService } from './upgrade-popup.service';

/** A seat the room has not assigned yet draws in the first seat's colour. */
const UNASSIGNED_AVATAR_INDEX = 0;

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
  host: { '[style.--popup-seat-colour]': 'seatColour()', '[attr.data-placement]': 'placement()' },
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
export class UpgradePopupComponent {
  private readonly gameState = inject(GameStateService);
  private readonly current = inject(UpgradePopupService).current;

  protected readonly popupTestId = POPUP_TEST_ID;
  protected readonly kind = UPGRADE_POPUP_KIND;
  /** Above the cell while alive, under the death text while dead (`upgradePopupPlacementFor`). */
  protected readonly placement = computed(() =>
    upgradePopupPlacementFor(this.gameState.ownProgress()?.lifeState ?? null),
  );
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
}
