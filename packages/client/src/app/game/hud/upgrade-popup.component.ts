// The upgrade and form popups (docs/ui/overlays.md §3.8, #783): the trait just gained, its tier and its effect lines,
// centred above the own cell, its bottom edge where the picker band's top edge is below it, so it never enters the
// exclusion box or the cap orbit (docs/ui/layout.md §1). An upgrade popup pops in, holds and rises as it fades; a form
// popup is larger, scales in with a glow in the seat colour, holds about five seconds and adds its real-life line.
// Under reduced motion both only fade. It decides nothing: `UpgradePopupService` says which popup is up and what it
// says. It is read, never pressed: no pointer, no focus, a polite live region.

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { HUD_TEST_ID } from '../test-ids/hud-test-ids';
import { UiEffectMarkComponent } from '../../ui-kit/ui-effect-mark.component';
import { paletteFor } from '../render/palette';
import { GameStateService } from '../state/game-state.service';
import { UPGRADE_POPUP_KIND } from './format/upgrade-popups';
import { UpgradePopupService } from './upgrade-popup.service';

/** A seat the room has not assigned yet draws in the first seat's colour. */
const UNASSIGNED_AVATAR_INDEX = 0;

@Component({
  selector: 'app-upgrade-popup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiEffectMarkComponent],
  styleUrl: './upgrade-popup.component.css',
  host: { '[style.--popup-seat-colour]': 'seatColour()' },
  template: `
    <div class="live" role="status" aria-live="polite">
      <!-- A list of at most one, keyed per popup, so the next one is a new element and replays its animation. -->
      @for (popup of shown(); track popup.key) {
        <div
          class="popup"
          [class.form]="popup.kind === kind.form"
          [attr.data-testid]="popup.kind === kind.form ? testId.formPopup : testId.upgradePopup"
          [attr.data-trait-id]="popup.traitId"
        >
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

  protected readonly testId = HUD_TEST_ID;
  protected readonly kind = UPGRADE_POPUP_KIND;
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
