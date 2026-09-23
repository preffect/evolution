// The connection banner (docs/ui/overlays.md §3.6, docs/ui/components-and-constants.md §7): full width
// along the top edge while the socket is down, so a dropped connection never looks like a frozen dish.
// `connectionBannerFor` decides; this binds its record.

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CONNECTION_BANNER_TONE, connectionBannerFor } from './format/connection-banner';
import { HUD_TEST_ID } from '../test-ids/hud-test-ids';
import { GameStateService } from '../state/game-state.service';

@Component({
  selector: 'app-connection-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (banner().isVisible) {
      <div
        class="notice-row"
        role="status"
        aria-live="polite"
        [class.danger]="banner().tone === tone.danger"
        [attr.data-testid]="testId.connectionBanner"
        [attr.data-connection-state]="state()"
      >
        <span class="message">{{ banner().text }}</span>
      </div>
    }
  `,
  styleUrl: './notice-row.css',
})
export class ConnectionBannerComponent {
  private readonly gameState = inject(GameStateService);

  protected readonly testId = HUD_TEST_ID;
  protected readonly tone = CONNECTION_BANNER_TONE;
  protected readonly state = this.gameState.connectionState;
  protected readonly banner = computed(() => connectionBannerFor(this.state()));
}
