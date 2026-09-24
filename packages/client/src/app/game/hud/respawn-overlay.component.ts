// The death overlay (docs/ui/overlays.md §3.3): while the player spectates, a light dim over the dish and three lines
// at top-centre — who engulfed them, the respawn countdown, and what death kept and cost. The camera follows the
// killer, so the centre stays clear, and the layer never takes the pointer: an open trait offer stays pickable.
//
// Mounted for the whole round, not only while dead: the DNA lost is a drop from the last alive snapshot, and that
// memory (`GameStateService.lastAliveOwnProgress`) only steps while something reads it.

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PLAYER_LIFE_STATE } from '@evolution/shared';
import { GameStateService } from '../state/game-state.service';
import { respawnLinesFor, type RespawnLines } from './format/respawn-lines';
import { HUD_TEST_ID } from '../test-ids/hud-test-ids';

@Component({
  selector: 'app-respawn-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (lines(); as lines) {
      <div class="dim" [attr.data-testid]="testId.respawnOverlay">
        <div class="text">
          <div class="killer" [attr.data-testid]="testId.respawnKiller">{{ lines.killer }}</div>
          <div class="countdown" aria-live="polite" [attr.data-testid]="testId.respawnCountdown">
            {{ lines.countdown }}
          </div>
          <div class="kept" [attr.data-testid]="testId.respawnKept">{{ lines.kept }}</div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        position: absolute;
        inset: 0;
        display: block;
        pointer-events: none;
      }

      .dim {
        position: absolute;
        inset: 0;
        background: rgb(0 0 0 / var(--hud-respawn-dim-alpha));
      }

      .text {
        position: absolute;
        top: calc(var(--hud-respawn-top) * var(--ui-scale));
        left: 50%;
        width: calc(var(--hud-respawn-width) * var(--ui-scale));
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: calc(var(--ui-space-xs) * var(--ui-scale));
        text-align: center;
        text-shadow: 0 1px 3px var(--hud-outline);
      }

      /* One line always: the name is already cut, so this only guards a glyph wider than measured. */
      .killer {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--ui-danger);
        font-family: var(--ui-font-sans);
        font-size: calc(var(--ui-type-title) * var(--ui-scale));
        font-weight: 700;
        letter-spacing: var(--ui-label-tracking);
      }

      .countdown {
        color: var(--ui-text);
        font-family: var(--ui-font-mono);
        font-size: calc(var(--ui-type-value) * var(--ui-scale));
      }

      .kept {
        color: var(--ui-text-muted);
        font-family: var(--ui-font-sans);
        font-size: calc(var(--ui-type-body) * var(--ui-scale));
      }
    `,
  ],
})
export class RespawnOverlayComponent {
  private readonly gameState = inject(GameStateService);

  protected readonly testId = HUD_TEST_ID;

  /** The three lines while spectating, `null` while alive or before the room names us. */
  protected readonly lines = computed<RespawnLines | null>(() => {
    // Read first and always, so the memory steps on every alive snapshot (see the header).
    const lastAliveOwnProgress = this.gameState.lastAliveOwnProgress();
    const ownProgress = this.gameState.ownProgress();
    if (ownProgress === null || ownProgress.lifeState !== PLAYER_LIFE_STATE.spectating) return null;
    return respawnLinesFor({
      ownProgress,
      cells: this.gameState.cells(),
      players: this.gameState.players(),
      lastAliveOwnProgress,
    });
  });
}
