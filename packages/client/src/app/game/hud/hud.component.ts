// The HUD shell (docs/ui/layout.md §1, docs/ui/components-and-constants.md §7): the overlay layer over the canvas. It owns two things —
// the UI kit's tokens with `--ui-scale`, read from its own box through the kit's pure `uiScaleFor` (the type, colour
// and scale home every HUD stylesheet reads since #381), and the HUD's own `--hud-…` sizes (`hud-css-variables.ts`) —
// and hosts the chrome. The layer itself never takes the pointer: only the controls inside it opt back in,
// so a click always reaches the dish.
//
// It also owns the one gate the chrome shares: the round phase (docs/ui/hud.md §3.1).
//
// The chrome is the leaderboard and the round clock (docs/ui/hud.md §3.1.1), plus the own cell's status
// mirror (§3.1.4), which carries no pixels of its own, the trait picker (docs/ui/overlays.md §3.2, #188) and the
// onboarding hint pill (docs/ui/input-and-onboarding.md §5, #530); the death and results overlays (#189) and the toasts
// (#190) slot in here as they land.

import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, type OnInit } from '@angular/core';
import { ROUND_PHASE } from '@evolution/shared';
import { GameStateService } from '../state/game-state.service';
import { ConnectionBannerComponent } from './connection-banner.component';
import { CONNECTION_STATE, noticeRowCountFor } from './format/connection-banner';
import { LeaderboardPanelComponent } from './leaderboard-panel.component';
import { HintComponent } from './hint.component';
import { HudStateService } from './hud-state.service';
import { MenuOverlayComponent } from './menu-overlay.component';
import { ServerErrorNoticeComponent } from './server-error-notice.component';
import { OwnCellStatusComponent } from './own-cell-status.component';
import { RoundTimerComponent } from './round-timer.component';
import { TraitOfferOverlayComponent } from './trait-offer-overlay.component';
import { HUD_TEST_ID } from '../test-ids/hud-test-ids';
import { uiScaleFor } from '../../ui-kit/format/ui-scale';
import { uiScaleVariable, uiStyleVariables } from '../../ui-kit/format/ui-css-variables';
import { hudStyleVariables, noticeRowsVariable, pickerBandVariables } from './format/hud-css-variables';
import { ElementSizeTracker } from '../../ui-kit/element-size';
import { AffectingPanelComponent } from './affecting-panel.component';
import { EncyclopediaOverlayComponent } from './encyclopedia-overlay.component';
import { HUD_OVERLAY } from './hud-state.service';

@Component({
  selector: 'app-hud',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AffectingPanelComponent,
    ConnectionBannerComponent,
    EncyclopediaOverlayComponent,
    HintComponent,
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
      <!-- The board and the clock stand down under the encyclopedia (docs/ui/encyclopedia.md §11.1): the panel would
           cut both into slivers, and what a reader must not miss is on its alert strip instead. -->
      @if (!isEncyclopediaOpen()) {
        <app-leaderboard-panel />
      }
      <!-- Opens and closes with the full board, top-left against it (docs/ui/overlays.md §3.7); it draws
           nothing while the board is shut or the player is spectating, so it needs no gate of its own. -->
      <app-affecting-panel />
    }
    @if (!isEncyclopediaOpen()) {
      <app-round-timer />
    }
    <!-- One onboarding beat at a time, bottom-centre (docs/ui/input-and-onboarding.md §5); it stands down on its own
         outside play, while dead and while the picker is open, and it is mounted throughout so the queue keeps stepping. -->
    <app-hint />
    <!-- Not phase-gated: the mirror stands down on its own when there is no own cell to mirror,
         so the results phase does not need to gate it. It does unmount on death, which announces
         nothing; speaking the death is #189's, with the death overlay. -->
    <app-own-cell-status />
    <!-- Over the picker and the chrome, under the notices (docs/ui/overlays.md §3.5); not phase-gated, since Escape
         opens it between rounds too. -->
    @if (isMenuOpen()) {
      <app-menu-overlay />
    }
    <!-- The encyclopedia replaces the menu rather than stacking on it (docs/ui/encyclopedia.md §11.1); the chrome
         above hides under it, since the panel would cut the board and the clock into slivers. -->
    @if (isEncyclopediaOpen()) {
      <app-encyclopedia-overlay />
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
        max-height: calc(var(--hud-notice-stack-max-y) * var(--ui-scale));
        overflow: hidden;
      }
    `,
  ],
})
export class HudComponent implements OnInit {
  private readonly gameState = inject(GameStateService);
  private readonly hudState = inject(HudStateService);
  private readonly sizeTracker = new ElementSizeTracker(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement);
  /**
   * The kit's tokens (docs/ui/components-and-constants.md §10.1). The shell IS the HUD's kit surface, so the
   * `--ui-…` every kit stylesheet reads are published from here. It spreads the kit's own pure maps rather than
   * wearing `[uiSurface]`: the directive and this component would both bind `[style]` on the one host, and the
   * shell already observes that same box with the same `ElementSizeTracker` and the same `uiScaleFor`, so a
   * second observer would measure the same element twice to reach the same number.
   *
   * This does not change how the ESC menu (#434) renders, which is mounted here and reads `--ui-…` too: it wears
   * its own `[uiSurface]` on `div.layer`, republishing the identical token set, so the nearer surface wins and the
   * shell's are invisible to it. The shell is therefore a token-publishing ancestor of a second surface, which
   * `ui-kit/ui-surface.directive.ts` ("one per layer") warns against, and two `ElementSizeTracker`s now measure for
   * the same scale. Inert because both publish the same values; #381 moved the rest of the HUD onto these tokens and
   * left the menu's own surface in place, since removing it changes nothing on screen.
   */
  private readonly kitTokens = uiStyleVariables();

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

  /** The encyclopedia (docs/ui/encyclopedia.md §11.1): a modal reading screen, likewise not phase-gated. */
  protected readonly isEncyclopediaOpen = computed(() => this.hudState.openOverlay() === HUD_OVERLAY.encyclopedia);

  /** The socket is down: the last snapshot stays on screen, dimmed, under the banner (docs/ui/overlays.md §3.6). */
  protected readonly isConnectionLost = computed(
    () => this.gameState.connectionState() === CONNECTION_STATE.disconnected,
  );

  /** `--ui-scale` (docs/ui/layout.md §1): unitless, so hit-testing and focus rings stay in real pixels. */
  protected readonly scale = computed(() =>
    uiScaleFor(this.sizeTracker.size().widthPx, this.sizeTracker.size().heightPx),
  );

  /** The scale plus every constant the child stylesheets read — the kit's and the HUD's — as one style map. */
  protected readonly styleVariables = computed(() => ({
    ...this.kitTokens,
    ...uiScaleVariable(this.scale()),
    ...hudStyleVariables(),
    ...pickerBandVariables({ width: this.sizeTracker.size().widthPx, height: this.sizeTracker.size().heightPx }),
    ...noticeRowsVariable(noticeRowCountFor(this.gameState.connectionState(), this.gameState.serverError())),
  }));

  ngOnInit(): void {
    this.sizeTracker.start();
  }
}
