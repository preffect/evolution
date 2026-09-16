// The alert strip (docs/ui/encyclopedia.md §11.1) over the pure `overlayAlertFor`: a kit alert pill showing the one
// fact a modal overlay must not hide, and a button that closes every overlay, so focus goes back to the canvas host.
// The menu renders it (docs/ui/overlays.md §3.5); the HUD shell projects it into the encyclopedia's header (#372).
// The host passes the test id, so each placement keeps its own (`menu-alert`, `encyclopedia-alert`).

import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { UiAlertPillComponent } from '../../ui-kit/ui-alert-pill.component';
import { GameStateService } from '../state/game-state.service';
import { overlayAlertFor } from './format/overlay-alert';
import { HudStateService } from './hud-state.service';

@Component({
  selector: 'app-overlay-alert',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiAlertPillComponent],
  template: `
    @if (alert(); as shown) {
      <button
        type="button"
        class="strip"
        uiAlertPill
        [tone]="shown.tone"
        [figure]="shown.figure"
        [keyHints]="shown.keyHints"
        [testId]="testId()"
        [attr.data-alert-kind]="shown.kind"
        (click)="returnToGame()"
      >
        {{ shown.text }}
      </button>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      /* Full width, its words from the leading edge and the offer's keys right after its seconds (the mockups). */
      .strip {
        width: 100%;
        justify-content: flex-start;
      }
    `,
  ],
})
export class OverlayAlertComponent {
  readonly testId = input.required<string>();

  private readonly gameState = inject(GameStateService);
  private readonly hudState = inject(HudStateService);

  protected readonly alert = computed(() =>
    overlayAlertFor({
      indicators: this.gameState.ownCellIndicators(),
      progress: this.gameState.ownProgress(),
      balance: this.gameState.balance(),
      serverTick: this.gameState.serverTickEstimate(),
    }),
  );

  protected returnToGame(): void {
    this.hudState.closeOverlays();
  }
}
