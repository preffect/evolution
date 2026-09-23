// What each onboarding beat says (docs/ui/input-and-onboarding.md §5). Terse, plain words; the one number, the
// endosymbiosis count, comes from its constant rather than being typed. The `offer` beat has no pill of its own —
// the pill hides while the picker is open (docs/ui/overlays.md §3.2) — so its words are the picker's extra footer line.

import { ENDOSYMBIOSIS_BACTERIA_REQUIRED } from '@evolution/shared';
import { ONBOARDING_BEAT, type OnboardingBeatId } from './onboarding-beats';

/** How the player sprints: a key on a keyboard, a tap on a touch screen. */
export const SPRINT_INPUT = { keyboard: 'SPACE', touch: 'TAP' } as const;

/** The picker's extra footer line while the `offer` beat is up. */
export const OFFER_BEAT_LINE = '1 2 3 or click · you keep swimming';

/** The pill's words for `beat`; `isTouch` picks the sprint prompt. */
export function onboardingTextFor(beat: OnboardingBeatId, isTouch: boolean): string {
  switch (beat) {
    case ONBOARDING_BEAT.steer:
      return 'Move the pointer · your cell follows';
    case ONBOARDING_BEAT.eat:
      return 'Swallow motes to grow';
    case ONBOARDING_BEAT.dna:
      return 'DNA fills the ring around your nucleus · fill it to evolve';
    case ONBOARDING_BEAT.sprint:
      return `${isTouch ? SPRINT_INPUT.touch : SPRINT_INPUT.keyboard} sprint · costs mass · your white ring recharges`;
    case ONBOARDING_BEAT.offer:
      return OFFER_BEAT_LINE;
    case ONBOARDING_BEAT.endosymbiosis:
      return `Eat ${ENDOSYMBIOSIS_BACTERIA_REQUIRED} orange rods at the warm vent or ${ENDOSYMBIOSIS_BACTERIA_REQUIRED} green in the shallows · the pips count them`;
    case ONBOARDING_BEAT.threat:
      return 'Bigger cells engulf you · sprint away';
  }
}
