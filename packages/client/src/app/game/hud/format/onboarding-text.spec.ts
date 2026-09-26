// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, ENDOSYMBIOSIS_BACTERIA_REQUIRED } from '@evolution/shared';
import { ONBOARDING_BEAT } from './onboarding-beats';
import { OFFER_BEAT_LINE, onboardingTextFor, type OnboardingTextContext } from './onboarding-text';
import { multiplierText, ownGelSpeedFactor } from './zone-pill';

const OWN_MASS = 96;
const KEYBOARD: OnboardingTextContext = { isTouch: false, balance: DEFAULT_BALANCE, ownMass: OWN_MASS, ownTraits: [] };

describe('onboardingTextFor', () => {
  it('says §5’s words for each opening beat', () => {
    expect(onboardingTextFor(ONBOARDING_BEAT.steer, KEYBOARD)).toBe('Move the pointer · your cell follows');
    expect(onboardingTextFor(ONBOARDING_BEAT.eat, KEYBOARD)).toBe('Swallow motes to grow');
    expect(onboardingTextFor(ONBOARDING_BEAT.dna, KEYBOARD)).toBe(
      'DNA fills the ring around your nucleus · fill it to evolve',
    );
    expect(onboardingTextFor(ONBOARDING_BEAT.threat, KEYBOARD)).toBe('Bigger cells engulf you · sprint away');
    expect(onboardingTextFor(ONBOARDING_BEAT.offer, KEYBOARD)).toBe(OFFER_BEAT_LINE);
  });

  it('names Space on a keyboard and a tap on a touch screen for the sprint', () => {
    expect(onboardingTextFor(ONBOARDING_BEAT.sprint, KEYBOARD)).toBe(
      'SPACE sprint · costs mass · your white ring recharges',
    );
    expect(onboardingTextFor(ONBOARDING_BEAT.sprint, { ...KEYBOARD, isTouch: true })).toBe(
      'TAP sprint · costs mass · your white ring recharges',
    );
  });

  it('takes the endosymbiosis count from its constant', () => {
    expect(onboardingTextFor(ONBOARDING_BEAT.endosymbiosis, KEYBOARD)).toBe(
      `Eat ${ENDOSYMBIOSIS_BACTERIA_REQUIRED} orange rods at the warm vent or ${ENDOSYMBIOSIS_BACTERIA_REQUIRED} green in the shallows · the pips count them`,
    );
  });

  it('says §5’s words for each coach beat', () => {
    expect(onboardingTextFor(ONBOARDING_BEAT.shrink, KEYBOARD)).toBe(
      'You burn mass when you stop eating · hold TAB for why',
    );
    expect(onboardingTextFor(ONBOARDING_BEAT.zoneSunlitShallows, KEYBOARD)).toBe(
      'Sunlight feeds a Chloroplast · green rods live here',
    );
    expect(onboardingTextFor(ONBOARDING_BEAT.bloom, KEYBOARD)).toBe('Bloom · more food and DNA until the end');
    expect(onboardingTextFor(ONBOARDING_BEAT.prey, KEYBOARD)).toBe('Green ring: you can engulf it · swim over it');
    expect(onboardingTextFor(ONBOARDING_BEAT.toxin, KEYBOARD)).toBe(
      'Toxic cells drain you when you are close · back off',
    );
  });

  it('formats the vent multiplier from balance', () => {
    expect(onboardingTextFor(ONBOARDING_BEAT.zoneWarmVent, KEYBOARD)).toBe(
      `The vent burns mass ${multiplierText(DEFAULT_BALANCE.ecology.VENT_DECAY_MULTIPLIER)} · orange rods live here`,
    );
    expect(multiplierText(DEFAULT_BALANCE.ecology.VENT_DECAY_MULTIPLIER)).toBe('×1.5');
  });

  it('formats the gel factor at the own mass, so a bigger cell reads a slower gel', () => {
    const factor = ownGelSpeedFactor({ mass: OWN_MASS, traits: [], balance: DEFAULT_BALANCE });
    expect(onboardingTextFor(ONBOARDING_BEAT.zoneViscousGel, KEYBOARD)).toBe(
      `Gel slows you to ${multiplierText(factor)} · smaller cells slip through`,
    );
    const bigger = ownGelSpeedFactor({ mass: OWN_MASS * 10, traits: [], balance: DEFAULT_BALANCE });
    expect(bigger).toBeLessThan(factor);
  });
});
