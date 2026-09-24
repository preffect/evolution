// The round results screen (docs/ui/overlays.md §3.4): while the phase is `results`, a heavy dim over the frozen dish
// and the kit's modal panel in the centre — `ROUND OVER`, who won, every player ranked, the countdown to the next
// round and one way out. Rematch is automatic, so there is no button for it. When the next round starts the panel
// fades out (`animate.leave`) while the HUD comes back underneath.
//
// Nothing takes focus on its own: the round can end while the player holds Space to sprint, and a focused
// `Leave to lobby` would take that key. Tab reaches the button, since the input layer keeps Tab native while this
// overlay is up (`FOCUSABLE_OVERLAY_TEST_IDS`).

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ROUND_PHASE } from '@evolution/shared';
import { MultiplayerService } from '../../services/multiplayer.service';
import { UiButtonComponent } from '../../ui-kit/ui-button.component';
import { UiPanelComponent } from '../../ui-kit/ui-panel.component';
import { UiScrimComponent } from '../../ui-kit/ui-scrim.component';
import { UiSurfaceDirective } from '../../ui-kit/ui-surface.directive';
import { GameStateService } from '../state/game-state.service';
import { RESULTS_COLUMN_LABELS } from './format/leaderboard-labels';
import { ownRowTintFor } from './format/leaderboard-swatch';
import { RESULTS_TEXT, resultsLinesFor, type ResultsLines } from './format/results-lines';
import { RESULTS_SCRIM_ALPHA } from './hud-constants';
import { PlayerSwatchComponent } from './player-swatch.component';
import { rankingSourceFrom } from './ranking-source';
import { HUD_TEST_ID, resultsRowTestId } from '../test-ids/hud-test-ids';

@Component({
  selector: 'app-results-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlayerSwatchComponent, UiButtonComponent, UiPanelComponent, UiScrimComponent, UiSurfaceDirective],
  styleUrl: './results-overlay.component.css',
  template: `
    @if (lines(); as lines) {
      <div class="layer" uiSurface animate.leave="leaving">
        <ui-scrim [alpha]="scrimAlpha" />
        <ui-panel class="results" variant="modal" [testId]="testId.resultsOverlay">
          <div class="heading" uiPanelHeader>
            <p class="title">{{ text.title }}</p>
            @if (lines.winner; as winner) {
              <p class="winner" [attr.data-testid]="testId.resultsWinner">
                <app-player-swatch class="winner-swatch" [avatarIndex]="winner.avatarIndex" />
                <span class="winner-text">{{ winner.text }}</span>
              </p>
            }
          </div>
          <div class="table">
            <!-- The numeric columns carry no unit, so the table names them, as the leaderboard does. -->
            <div class="column-labels" aria-hidden="true">
              @for (label of columnLabels; track label.className) {
                <span [class]="label.className">{{ label.text }}</span>
              }
            </div>
            <ol class="rows">
              @for (entry of lines.rows; track entry.playerId) {
                <li
                  class="row"
                  [class.own]="entry.isOwn"
                  [style.background]="entry.isOwn ? ownRowTint(entry.avatarIndex) : null"
                  [attr.data-testid]="rowTestId(entry.rank)"
                >
                  <span class="rank">{{ entry.rank }}</span>
                  <app-player-swatch [avatarIndex]="entry.avatarIndex" />
                  <span class="name">{{ entry.name }}</span>
                  <span class="level">L{{ entry.level }}</span>
                  <span class="mass">{{ entry.massText }}</span>
                  <span class="absorptions">{{ entry.absorptions }}</span>
                  <span class="score">{{ entry.scoreText }}</span>
                </li>
              }
            </ol>
          </div>
          <div class="footer" uiPanelFooter>
            <span class="countdown" aria-live="polite" [attr.data-testid]="testId.resultsCountdown">
              {{ lines.countdown }}
            </span>
            <button type="button" uiButton variant="primary" [testId]="testId.resultsLeave" (click)="leave()">
              {{ text.leave }}
            </button>
          </div>
        </ui-panel>
      </div>
    }
  `,
})
export class ResultsOverlayComponent {
  private readonly multiplayer = inject(MultiplayerService);
  private readonly gameState = inject(GameStateService);

  protected readonly testId = HUD_TEST_ID;
  protected readonly text = RESULTS_TEXT;
  protected readonly scrimAlpha = RESULTS_SCRIM_ALPHA;
  protected readonly columnLabels = RESULTS_COLUMN_LABELS;
  protected readonly ownRowTint = ownRowTintFor;
  protected readonly rowTestId = resultsRowTestId;

  /** What the panel says while the phase is `results`; `null` in play, which starts the fade. */
  protected readonly lines = computed<ResultsLines | null>(() => {
    const snapshot = this.gameState.snapshot();
    if (snapshot === null || snapshot.roundPhase !== ROUND_PHASE.results) return null;
    return resultsLinesFor({
      ...rankingSourceFrom(this.gameState),
      tick: snapshot.tick,
      resultsStartedAtTick: this.gameState.resultsStartedAtTick(),
      resultsScreenSeconds: this.gameState.balance()?.session.RESULTS_SCREEN_SECONDS ?? null,
    });
  });

  /** Leaving drops the seat (#319) and the lobby returns, as the menu's `Exit game` does. */
  protected leave(): void {
    this.multiplayer.leave();
  }
}
