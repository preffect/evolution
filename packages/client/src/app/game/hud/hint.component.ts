// The hint pill (docs/ui/input-and-onboarding.md §5): bottom-centre, `HUD_MARGIN_PX` from the bottom edge, `body` on
// the callout backing, one onboarding beat at a time with its id on `data-hint-id`; a coach beat's pill wears a
// `HINT_RIM_PX` rim in its cue's role colour. It decides nothing:
// `OnboardingService` says which beat is up and `onboardingTextFor` what it says. It stands down while the picker is
// open (docs/ui/overlays.md §3.2), whose own footer carries the `offer` beat, and whenever the player is not alive in
// play. It is read, never pressed: it takes no pointer and no focus, and speaks through a polite live region.

import { ChangeDetectionStrategy, Component, DOCUMENT, computed, inject } from '@angular/core';
import { PLAYER_LIFE_STATE, ROUND_PHASE } from '@evolution/shared';
import { GameStateService } from '../state/game-state.service';
import { ONBOARDING_BEATS } from './format/onboarding-queue';
import { onboardingTextFor } from './format/onboarding-text';
import { OnboardingService } from './onboarding.service';
import { HUD_TEST_ID } from '../test-ids/hud-test-ids';

/** A touch screen has no Space bar: the primary pointer is coarse. */
const TOUCH_POINTER_QUERY = '(pointer: coarse)';

@Component({
  selector: 'app-hint',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="live" role="status" aria-live="polite">
      @if (hint(); as shown) {
        <p
          class="pill"
          [class.rimmed]="shown.rimColour !== null"
          [style.--hint-rim-colour]="shown.rimColour"
          [attr.data-testid]="testId.hint"
          [attr.data-hint-id]="shown.id"
        >
          {{ shown.text }}
        </p>
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

      /*
       * The margin cap sits here, where 100% is the full-width host: on the pill it would resolve against this
       * shrink-to-fit box and wrap every hint, however short.
       */
      .live {
        max-width: calc(100% - 2 * var(--hud-margin) * var(--hud-scale));
      }

      /* The notice row's height and inset, rounded into a pill: one callout surface for every line of words. */
      /*
       * One line at the notice row's height where it fits; a long line (the endosymbiosis beat is ~650 px) wraps
       * inside the viewport's margins on a narrow screen rather than running off it, and the pill grows with it.
       */
      .pill {
        box-sizing: border-box;
        display: flex;
        align-items: center;
        min-height: calc(var(--hud-notice-row-height) * var(--hud-scale));
        max-width: 100%;
        margin: 0;
        padding-inline: calc(var(--hud-notice-padding-inline) * var(--hud-scale));
        /* One line fills the notice row's height exactly; each further line adds its own. */
        --hint-line-height: 1.25;
        padding-block: calc(
          (var(--hud-notice-row-height) - var(--hud-type-body) * var(--hint-line-height)) / 2 * var(--hud-scale)
        );
        border-radius: calc(var(--hud-notice-row-height) / 2 * var(--hud-scale));
        background: var(--hud-callout-backing);
        font-family: var(--hud-font-sans);
        font-size: calc(var(--hud-type-body) * var(--hud-scale));
        line-height: var(--hint-line-height);
        color: var(--hud-text);
        text-align: center;
      }

      /* A coach beat's rim in the role colour of the cue it explains; the text stays in the text colour (§5). */
      .pill.rimmed {
        border: calc(var(--hud-hint-rim) * var(--hud-scale)) solid var(--hint-rim-colour);
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

  /** The beat on screen, its words and its rim colour, or `null` when the pill is down. */
  protected readonly hint = computed(() => {
    const id = this.onboarding.current();
    const balance = this.gameState.balance();
    const ownCell = this.gameState.ownCell();
    if (id === null || !this.isShowable() || balance === null || ownCell === null) return null;
    const text = onboardingTextFor(id, {
      isTouch: this.isTouch,
      balance,
      ownMass: ownCell.mass,
      ownTraits: ownCell.traits,
    });
    return { id, text, rimColour: ONBOARDING_BEATS.find((beat) => beat.id === id)?.rimColour ?? null };
  });
}
