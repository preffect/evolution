// The HUD shell (docs/ui/layout.md §1, docs/ui/components-and-constants.md §7): the overlay layer over the canvas. It owns two things —
// `--hud-scale`, read from its own box through the kit's pure `uiScaleFor`, and the rest of the
// `--hud-…` custom properties every child stylesheet reads (`hud-css-variables.ts`) — and hosts
// the chrome. The layer itself never takes the pointer: only the controls inside it opt back in,
// so a click always reaches the dish.
//
// It also owns the one gate the chrome shares: the round phase (docs/ui/hud.md §3.1).
//
// The chrome is the leaderboard and the round clock (docs/ui/hud.md §3.1.1), plus the own cell's status
// mirror (§3.1.4), which carries no pixels of its own, and the trait picker (docs/ui/overlays.md §3.2, #188); the death
// and results overlays (#189) and the notices (#190) slot in here as they land.

import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, type OnInit } from '@angular/core';
import { ROUND_PHASE } from '@evolution/shared';
import { GameStateService } from '../state/game-state.service';
import { ConnectionBannerComponent } from './connection-banner.component';
import { CONNECTION_STATE, noticeRowCountFor } from './format/connection-banner';
import { LeaderboardPanelComponent } from './leaderboard-panel.component';
import { HudStateService } from './hud-state.service';
import { MenuOverlayComponent } from './menu-overlay.component';
import { ServerErrorNoticeComponent } from './server-error-notice.component';
import { OwnCellStatusComponent } from './own-cell-status.component';
import { RoundTimerComponent } from './round-timer.component';
import { TraitOfferOverlayComponent } from './trait-offer-overlay.component';
import { HUD_TEST_ID } from './test-ids';
import { uiScaleFor } from '../../ui-kit/format/ui-scale';
import { hudStyleVariables, noticeRowsVariable, pickerBandVariables } from './format/hud-css-variables';
import { ElementSizeTracker } from '../../ui-kit/element-size';

@Component({
  selector: 'app-hud',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ConnectionBannerComponent,
    LeaderboardPanelComponent,
    MenuOverlayComponent,
    OwnCellStatusComponent,
    RoundTimerComponent,
    ServerErrorNoticeComponent,
    TraitOfferOverlayComponent,
  ],
  template: `
    @if (isRoundPlaying()) {
      <!-- The picker draws nothing without an open offer, and an offer stays pickable while spectating (§3.3). -->
      <app-trait-offer-overlay />
      <app-leaderboard-panel />
    }
    <app-round-timer />
    <!-- Not phase-gated: the mirror stands down on its own when there is no own cell to mirror,
         so the results phase does not need to gate it. It does unmount on death, which announces
         nothing; speaking the death is #189's, with the death overlay. -->
    <app-own-cell-status />
    <!-- Over the picker and the chrome, under the notices (docs/ui/overlays.md §3.5); not phase-gated, since Escape
         opens it between rounds too. -->
    @if (isMenuOpen()) {
      <app-menu-overlay />
    }
    <!-- Last, so they paint over the chrome (docs/ui/overlays.md §3.6): the dish stays, dimmed, under
         the banner while the socket is down, and the notices stack from the top edge. -->
    @if (isConnectionLost()) {
      <div class="connection-lost-dim"></div>
    }
    <div class="notices">
      <app-connection-banner />
      <app-server-error-notice />
    </div>
  `,
  host: {
    '[attr.data-testid]': 'testId.hud',
    '[style]': 'styleVariables()',
  },
  styles: [
    `
      :host {
        position: absolute;
        inset: 0;
        display: block;
        /* The layer never eats a click: the controls inside it set their own pointer-events. */
        pointer-events: none;
        user-select: none;
      }

      .connection-lost-dim {
        position: absolute;
        inset: 0;
        background: rgb(0 0 0 / var(--hud-connection-lost-dim-alpha));
      }

      /* Never downward past y 96 (docs/ui/input-and-onboarding.md §6), however many rows are up. */
      .notices {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        max-height: calc(var(--hud-notice-stack-max-y) * var(--hud-scale));
        overflow: hidden;
      }
    `,
  ],
})
export class HudComponent implements OnInit {
  private readonly gameState = inject(GameStateService);
  private readonly hudState = inject(HudStateService);
  private readonly sizeTracker = new ElementSizeTracker(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement);

  protected readonly testId = HUD_TEST_ID;

  /**
   * The in-round chrome stands down for the results phase (docs/ui/hud.md §3.1, §3.1.1), where #189's
   * overlay claims the screen and would otherwise share the top-right with the board. It does
   * **not** gate on `lifeState`: the board is §3.1.1's stated exception, because a dead player
   * watching their killer is exactly who wants to see the ranking. The clock's own `isVisible`
   * covers more than the phase (it also has no digits to show before the first snapshot), so it
   * keeps its gate rather than borrowing this one.
   */
  protected readonly isRoundPlaying = computed(() => this.gameState.roundPhase() === ROUND_PHASE.playing);

  /** The Escape menu (docs/ui/overlays.md §3.5), in play and between rounds alike. */
  protected readonly isMenuOpen = this.hudState.isMenuOpen;

  /** The socket is down: the last snapshot stays on screen, dimmed, under the banner (docs/ui/overlays.md §3.6). */
  protected readonly isConnectionLost = computed(
    () => this.gameState.connectionState() === CONNECTION_STATE.disconnected,
  );

  /** `--hud-scale` (docs/ui/layout.md §1): unitless, so hit-testing and focus rings stay in real pixels. */
  protected readonly scale = computed(() =>
    uiScaleFor(this.sizeTracker.size().widthPx, this.sizeTracker.size().heightPx),
  );

  /** The scale plus every constant the child stylesheets read, as one style map. */
  protected readonly styleVariables = computed(() => ({
    ...hudStyleVariables(this.scale()),
    ...pickerBandVariables({ width: this.sizeTracker.size().widthPx, height: this.sizeTracker.size().heightPx }),
    ...noticeRowsVariable(noticeRowCountFor(this.gameState.connectionState(), this.gameState.serverError())),
  }));

  ngOnInit(): void {
    this.sizeTracker.start();
  }
}
