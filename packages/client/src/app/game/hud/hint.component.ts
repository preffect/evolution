// The hint pill (docs/ui/input-and-onboarding.md §5): bottom-centre, `HUD_MARGIN_PX` from the bottom edge, `body` on
// the callout backing, one onboarding beat at a time with its id on `data-hint-id`. It decides nothing:
// `OnboardingService` says which beat is up and `onboardingTextFor` what it says. It stands down while the picker is
// open (docs/ui/overlays.md §3.2), whose own footer carries the `offer` beat, and whenever the player is not alive in
// play. It is read, never pressed: it takes no pointer and no focus, and speaks through a polite live region.

import { ChangeDetectionStrategy, Component, DOCUMENT, computed, inject } from '@angular/core';
import { PLAYER_LIFE_STATE, ROUND_PHASE } from '@evolution/shared';
import { GameStateService } from '../state/game-state.service';
import { onboardingTextFor } from './format/onboarding-text';
import { OnboardingService } from './onboarding.service';
import { HUD_TEST_ID } from './test-ids';

/** A touch screen has no Space bar: the primary pointer is coarse. */
const TOUCH_POINTER_QUERY = '(pointer: coarse)';

@Component({
  selector: 'app-hint',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="live" role="status" aria-live="polite">
      @if (hint(); as shown) {
        <p class="pill" [attr.data-testid]="testId.hint" [attr.data-hint-id]="shown.id">{{ shown.text }}</p>
      }
    </div>
  `,
  styles: [
    `
      :host {
        position: absolute;
        left: 0;
        right: 0;
        bottom: calc(var(--hud-margin) * var(--hud-scale));
        display: flex;
        justify-content: center;
        pointer-events: none;
      }

      /* The notice row's height and inset, rounded into a pill: one callout surface for every line of words. */
      .pill {
        box-sizing: border-box;
        display: flex;
        align-items: center;
        height: calc(var(--hud-notice-row-height) * var(--hud-scale));
        margin: 0;
        padding-inline: calc(var(--hud-notice-padding-inline) * var(--hud-scale));
        border-radius: calc(var(--hud-notice-row-height) * var(--hud-scale));
        background: var(--hud-callout-backing);
        font-family: var(--hud-font-sans);
        font-size: calc(var(--hud-type-body) * var(--hud-scale));
        line-height: 1;
        color: var(--hud-text);
        white-space: nowrap;
      }
    `,
  ],
})
export class HintComponent {
  private readonly gameState = inject(GameStateService);
  private readonly onboarding = inject(OnboardingService);
  private readonly isTouch = inject(DOCUMENT).defaultView?.matchMedia?.(TOUCH_POINTER_QUERY).matches ?? false;

  protected readonly testId = HUD_TEST_ID;

  private readonly isShowable = computed(() => {
    const progress = this.gameState.ownProgress();
    return (
      this.gameState.roundPhase() === ROUND_PHASE.playing &&
      progress?.lifeState === PLAYER_LIFE_STATE.alive &&
      progress.offer === null
    );
  });

  /** The beat on screen and its words, or `null` when the pill is down. */
  protected readonly hint = computed(() => {
    const id = this.onboarding.current();
    if (id === null || !this.isShowable()) return null;
    return { id, text: onboardingTextFor(id, this.isTouch) };
  });
}
