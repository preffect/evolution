// The toast (docs/ui/overlays.md §3.6): one line top-centre, `HUD_MARGIN_PX` from the top edge and below any notice
// rows that are up, `body` on the callout backing, its kind on `data-toast-kind`. It decides nothing: `ToastService`
// says which toast is up and what it says. It is read, never pressed: no pointer, no focus, a polite live region.

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HUD_TEST_ID } from '../test-ids/hud-test-ids';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="live" role="status" aria-live="polite">
      @if (toast(); as shown) {
        <p class="toast" [attr.data-testid]="testId.toast" [attr.data-toast-kind]="shown.kind">{{ shown.text }}</p>
      }
    </div>
  `,
  styles: [
    `
      :host {
        position: absolute;
        left: 0;
        right: 0;
        /* Under the notice rows while any are up, like the leaderboard, so the banner never covers it. */
        top: calc((var(--hud-margin) + var(--hud-notice-row-height) * var(--hud-notice-rows, 0)) * var(--ui-scale));
        display: flex;
        justify-content: center;
        pointer-events: none;
      }

      /* 100% here is the full-width host; on the toast it would be its own shrink-to-fit box. */
      .live {
        max-width: calc(100% - 2 * var(--hud-margin) * var(--ui-scale));
      }

      .toast {
        box-sizing: border-box;
        margin: 0;
        padding: calc(var(--ui-space-s) * var(--ui-scale)) calc(var(--hud-notice-padding-inline) * var(--ui-scale));
        border-radius: calc(var(--ui-radius-panel) * var(--ui-scale));
        background: var(--ui-callout-backing);
        font-family: var(--ui-font-sans);
        font-size: calc(var(--ui-type-body) * var(--ui-scale));
        line-height: var(--ui-body-line-height);
        color: var(--ui-text);
        text-align: center;
      }
    `,
  ],
})
export class ToastComponent {
  protected readonly testId = HUD_TEST_ID;
  protected readonly toast = inject(ToastService).current;
}
