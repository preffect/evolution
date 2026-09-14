// The HUD shell (docs/ui/layout.md §1, docs/ui/components-and-constants.md §7): the overlay layer over the canvas. It owns two things —
// `--hud-scale`, read from its own box through the pure `hudScaleFor`, and the rest of the
// `--hud-…` custom properties every child stylesheet reads (`hud-css-variables.ts`) — and hosts
// the chrome. The layer itself never takes the pointer: only the controls inside it opt back in,
// so a click always reaches the dish.
//
// It also owns the one gate the chrome shares: the round phase (docs/ui/hud.md §3.1).
//
// The chrome is the leaderboard and the round clock (docs/ui/hud.md §3.1.1), plus the own cell's status
// mirror (§3.1.4), which carries no pixels of its own, and the trait picker (docs/ui/overlays.md §3.2, #188); the death
// and results overlays (#189) and the notices (#190) slot in here as they land.

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  type OnDestroy,
  type OnInit,
} from '@angular/core';
import { ROUND_PHASE } from '@evolution/shared';
import { GameStateService } from '../state/game-state.service';
import { LeaderboardPanelComponent } from './leaderboard-panel.component';
import { OwnCellStatusComponent } from './own-cell-status.component';
import { RoundTimerComponent } from './round-timer.component';
import { TraitOfferOverlayComponent } from './trait-offer-overlay.component';
import { HUD_TEST_ID } from './test-ids';
import { hudScaleFor } from './format/hud-scale';
import { hudStyleVariables } from './format/hud-css-variables';
import { observeElementSize, type ElementSize } from './element-size';

const NO_SIZE: ElementSize = { widthPx: 0, heightPx: 0 };

@Component({
  selector: 'app-hud',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LeaderboardPanelComponent, OwnCellStatusComponent, RoundTimerComponent, TraitOfferOverlayComponent],
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
    `,
  ],
})
export class HudComponent implements OnInit, OnDestroy {
  private readonly gameState = inject(GameStateService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly size = signal<ElementSize>(NO_SIZE);
  private stopObservingSize: (() => void) | null = null;

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

  /** `--hud-scale` (docs/ui/layout.md §1): unitless, so hit-testing and focus rings stay in real pixels. */
  protected readonly scale = computed(() => hudScaleFor(this.size().widthPx, this.size().heightPx));

  /** The scale plus every constant the child stylesheets read, as one style map. */
  protected readonly styleVariables = computed(() => hudStyleVariables(this.scale()));

  ngOnInit(): void {
    this.stopObservingSize = observeElementSize(this.host.nativeElement as HTMLElement, (size) => this.size.set(size));
  }

  ngOnDestroy(): void {
    this.stopObservingSize?.();
    this.stopObservingSize = null;
  }
}
