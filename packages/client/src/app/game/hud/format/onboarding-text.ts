// What each onboarding beat says (docs/ui/input-and-onboarding.md §5). Terse, plain words; every number comes from
// its constant or the live balance, never typed. The `offer` beat has no pill of its own — the pill hides while the
// picker is open (docs/ui/overlays.md §3.2) — so its words are the picker's extra footer line.

import { ENDOSYMBIOSIS_BACTERIA_REQUIRED, type BalanceConfig, type OwnedTrait } from '@evolution/shared';
import { ONBOARDING_BEAT, type OnboardingBeatId } from './onboarding-beats';
import { multiplierText, ownGelSpeedFactor } from './zone-pill';

/** How the player sprints: a key on a keyboard, a tap on a touch screen. */
export const SPRINT_INPUT = { keyboard: 'SPACE', touch: 'TAP' } as const;

/** The picker's extra footer line while the `offer` beat is up. */
export const OFFER_BEAT_LINE = '1 2 3 or click · you keep swimming';

/** What a pill's words read besides the beat: the input device and the numbers from balance at the own mass. */
export interface OnboardingTextContext {
  readonly isTouch: boolean;
  readonly balance: Pick<BalanceConfig, 'ecology' | 'growth' | 'traits'>;
  readonly ownMass: number;
  readonly ownTraits: readonly OwnedTrait[];
}

type TextFor = (context: OnboardingTextContext) => string;

const TEXT_BY_BEAT: Readonly<Record<OnboardingBeatId, TextFor>> = {
  [ONBOARDING_BEAT.steer]: () => 'Move the pointer · your cell follows',
  [ONBOARDING_BEAT.eat]: () => 'Swallow motes to grow',
  [ONBOARDING_BEAT.dna]: () => 'DNA fills the ring around your nucleus · fill it to evolve',
  [ONBOARDING_BEAT.sprint]: ({ isTouch }) =>
    `${isTouch ? SPRINT_INPUT.touch : SPRINT_INPUT.keyboard} sprint · costs mass · your white ring recharges`,
  [ONBOARDING_BEAT.offer]: () => OFFER_BEAT_LINE,
  [ONBOARDING_BEAT.endosymbiosis]: () =>
    `Eat ${ENDOSYMBIOSIS_BACTERIA_REQUIRED} orange rods at the warm vent or ${ENDOSYMBIOSIS_BACTERIA_REQUIRED} green in the shallows · the pips count them`,
  [ONBOARDING_BEAT.threat]: () => 'Bigger cells engulf you · sprint away',
  [ONBOARDING_BEAT.shrink]: () => 'You burn mass when you stop eating · hold TAB for why',
  [ONBOARDING_BEAT.zoneWarmVent]: ({ balance }) =>
    `The vent burns mass ${multiplierText(balance.ecology.VENT_DECAY_MULTIPLIER)} · orange rods live here`,
  [ONBOARDING_BEAT.zoneSunlitShallows]: () => 'Sunlight feeds a Chloroplast · green rods live here',
  [ONBOARDING_BEAT.zoneViscousGel]: ({ balance, ownMass, ownTraits }) =>
    `Gel slows you to ${multiplierText(ownGelSpeedFactor({ mass: ownMass, traits: ownTraits, balance }))} · smaller cells slip through`,
  [ONBOARDING_BEAT.bloom]: () => 'Bloom · more food and DNA until the end',
  [ONBOARDING_BEAT.toxin]: () => 'Toxic cells drain you when you are close · back off',
};

/** The pill's words for `beat`. */
export function onboardingTextFor(beat: OnboardingBeatId, context: OnboardingTextContext): string {
  return TEXT_BY_BEAT[beat](context);
}
