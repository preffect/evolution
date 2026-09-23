// The server's `error` message in play (#219): the lobby shows it under its header, and in play the
// shell renders only the game, so without this row an error during a round was swallowed. It stacks
// under the connection banner (docs/ui/overlays.md §3.6) and stays until the player dismisses it.

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MultiplayerService } from '../../services/multiplayer.service';
import { GameStateService } from '../state/game-state.service';
import { HUD_TEST_ID } from '../test-ids/hud-test-ids';

/** The caption before the server's own words, in play and in the lobby alike. */
export const SERVER_ERROR_CAPTION = 'Error:';
/** The dismiss control's accessible name; the control itself shows only a cross. */
export const SERVER_ERROR_DISMISS_LABEL = 'Dismiss error';

@Component({
  selector: 'app-server-error-notice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message(); as errorMessage) {
      <div class="notice-row danger" role="alert" [attr.data-testid]="testId.serverError">
        <span class="message">{{ caption }} {{ errorMessage }}</span>
        <button
          type="button"
          class="dismiss"
          [attr.aria-label]="dismissLabel"
          [attr.data-testid]="testId.serverErrorDismiss"
          (click)="dismiss()"
        >
          ×
        </button>
      </div>
    }
  `,
  styleUrls: ['./notice-row.css'],
  styles: [
    `
      /*
       * The one control in the strip opts back into the pointer the HUD layer gives up. Its hit area is the
       * row's full height and square, and it never shrinks, so a long message truncates before the control
       * would leave the screen.
       */
      .dismiss {
        flex-shrink: 0;
        align-self: stretch;
        display: flex;
        align-items: center;
        justify-content: center;
        inline-size: calc(var(--hud-notice-row-height) * var(--ui-scale));
        pointer-events: auto;
        cursor: pointer;
        padding: 0;
        border: 0;
        background: none;
        font: inherit;
        color: inherit;
      }

      /* Inset, so the ring stays inside the row's clip (as on the leaderboard header). */
      .dismiss:focus-visible {
        outline: var(--ui-focus-ring) solid var(--ui-text);
        outline-offset: calc(var(--ui-focus-ring) * -1);
      }
    `,
  ],
})
export class ServerErrorNoticeComponent {
  private readonly gameState = inject(GameStateService);
  private readonly multiplayer = inject(MultiplayerService);

  protected readonly testId = HUD_TEST_ID;
  protected readonly caption = SERVER_ERROR_CAPTION;
  protected readonly dismissLabel = SERVER_ERROR_DISMISS_LABEL;
  protected readonly message = this.gameState.serverError;

  protected dismiss(): void {
    this.multiplayer.dismissError();
  }
}
