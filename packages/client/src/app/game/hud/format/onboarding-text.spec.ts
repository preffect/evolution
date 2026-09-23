import { describe, expect, it } from 'vitest';
import { ENDOSYMBIOSIS_BACTERIA_REQUIRED } from '@evolution/shared';
import { ONBOARDING_BEAT } from './onboarding-beats';
import { OFFER_BEAT_LINE, onboardingTextFor } from './onboarding-text';

describe('onboardingTextFor', () => {
  it('says §5’s words for each beat', () => {
    expect(onboardingTextFor(ONBOARDING_BEAT.steer, false)).toBe('Move the pointer · your cell follows');
    expect(onboardingTextFor(ONBOARDING_BEAT.eat, false)).toBe('Swallow motes to grow');
    expect(onboardingTextFor(ONBOARDING_BEAT.dna, false)).toBe(
      'DNA fills the ring around your nucleus · fill it to evolve',
    );
    expect(onboardingTextFor(ONBOARDING_BEAT.threat, false)).toBe('Bigger cells engulf you · sprint away');
    expect(onboardingTextFor(ONBOARDING_BEAT.offer, false)).toBe(OFFER_BEAT_LINE);
  });

  it('names Space on a keyboard and a tap on a touch screen for the sprint', () => {
    expect(onboardingTextFor(ONBOARDING_BEAT.sprint, false)).toBe(
      'SPACE sprint · costs mass · your white ring recharges',
    );
    expect(onboardingTextFor(ONBOARDING_BEAT.sprint, true)).toBe('TAP sprint · costs mass · your white ring recharges');
  });

  it('takes the endosymbiosis count from its constant', () => {
    expect(onboardingTextFor(ONBOARDING_BEAT.endosymbiosis, false)).toBe(
      `Eat ${ENDOSYMBIOSIS_BACTERIA_REQUIRED} orange rods at the warm vent or ${ENDOSYMBIOSIS_BACTERIA_REQUIRED} green in the shallows · the pips count them`,
    );
  });
});
