// The round clock (docs/ui/hud.md §3.1.1): `m:ss` bottom-right with its caption under it, level gold
// through the bloom, pulsing once a second inside the last ten, and away through the results phase.
// It decides nothing: `roundClockStateFor` does, and this binds the record it answers. Every length
// and colour below is a `--hud-…` the shell publishes from the constants (`hud-css-variables.ts`).

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GameStateService } from '../state/game-state.service';
import { HUD_TEST_ID } from '../test-ids/hud-test-ids';
import { roundClockStateFor } from './format/round-clock';

@Component({
  selector: 'app-round-timer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (clock().isVisible) {
      <div class="round-timer" [class.bloom]="clock().isBloom" [class.pulsing]="clock().isPulsing">
        <span class="digits" role="timer" [attr.data-testid]="testId.roundClock">{{ clock().text }}</span>
        <span class="caption" [attr.data-testid]="testId.roundPhase">{{ clock().caption }}</span>
      </div>
    }
  `,
  styles: [
    `
      :host {
        position: absolute;
        right: calc(var(--hud-margin) * var(--ui-scale));
        bottom: calc(var(--hud-margin) * var(--ui-scale));
        pointer-events: none;
      }

      .round-timer {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        line-height: 1.1;
        text-shadow: 0 1px 3px var(--hud-outline);
      }

      .digits {
        font-family: var(--ui-font-mono);
        font-size: calc(var(--ui-type-clock) * var(--ui-scale));
        font-variant-numeric: tabular-nums;
        color: var(--ui-text);
      }

      .caption {
        font-family: var(--ui-font-sans);
        font-size: calc(var(--ui-type-caption) * var(--ui-scale));
        text-transform: uppercase;
        letter-spacing: var(--ui-label-tracking);
        color: var(--ui-text-label);
      }

      /* The bloom (docs/ecology/food-and-spawn.md §3.1): the one saturated colour the clock ever takes. */
      .round-timer.bloom .digits,
      .round-timer.bloom .caption {
        color: var(--ui-level-gold);
      }

      /* In bloom the caption names the effect, a fact, so it steps up from caption to label (docs/ui/hud.md §3.1.1). */
      .round-timer.bloom .caption {
        font-size: calc(var(--ui-type-label) * var(--ui-scale));
        white-space: nowrap;
      }

      /* One pulse per second through the last ten seconds (docs/ui/hud.md §3.1.1). */
      .round-timer.pulsing .digits {
        animation: round-clock-pulse var(--hud-clock-pulse-duration) ease-out infinite;
      }

      @keyframes round-clock-pulse {
        0% {
          opacity: 1;
          transform: scale(1);
        }
        18% {
          opacity: 1;
          transform: scale(1.08);
        }
        100% {
          opacity: 0.72;
          transform: scale(1);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .round-timer.pulsing .digits {
          animation: none;
        }
      }
    `,
  ],
})
export class RoundTimerComponent {
  private readonly gameState = inject(GameStateService);

  protected readonly testId = HUD_TEST_ID;

  protected readonly clock = computed(() =>
    roundClockStateFor({
      timeLeftMs: this.gameState.roundTimeLeftMs(),
      roundPhase: this.gameState.roundPhase(),
      roundDurationSeconds: this.gameState.sessionConfig()?.roundDurationSeconds ?? null,
      bloomStartFraction: this.gameState.balance()?.session.ROUND_BLOOM_START_FRACTION ?? null,
      foodBloomMultiplier: this.gameState.balance()?.ecology.FOOD_BLOOM_SPAWN_MULTIPLIER ?? null,
      dnaFragmentBloomMultiplier: this.gameState.balance()?.ecology.DNA_FRAGMENT_BLOOM_SPAWN_MULTIPLIER ?? null,
    }),
  );
}
