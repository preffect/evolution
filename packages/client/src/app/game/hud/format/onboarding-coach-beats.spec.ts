import { describe, expect, it } from 'vitest';
import { ZONE_ID, secondsToTicks } from '@evolution/shared';
import {
  TEST_ONBOARDING_RESPAWNED_CELL_ID as RESPAWNED,
  createTestOnboardingSample as sample,
  foldOnboardingSamples,
  onboardingPastOpening,
} from '../../../../testing/onboarding-builders';
import {
  COACH_QUEUE_MAX,
  COACH_SHRINK_HOLD_SECONDS,
  HINT_DURATION_SECONDS,
  HINT_MIN_SECONDS,
  SPRINT_HINT_AT_SECONDS,
} from '../hud-constants';
import { GAIN } from '../../render/constants';
import { COACH_BEATS } from './onboarding-coach-beats';
import { ONBOARDING_BEAT } from './onboarding-beats';
import { onboardingStepFor, type OnboardingMemory, type OnboardingSample } from './onboarding-queue';

const HOLD_TICKS = secondsToTicks(COACH_SHRINK_HOLD_SECONDS);
const HINT_TICKS = secondsToTicks(HINT_DURATION_SECONDS);
const SHRINKING = { isShrinkingFromDecay: true } as const;

/** Folds `samples` into a session past the opening beats. */
function after(...samples: readonly OnboardingSample[]): OnboardingMemory {
  return foldOnboardingSamples(samples, onboardingPastOpening());
}

/** The first alive snapshot of the session, from a fresh one. */
function run(...samples: readonly OnboardingSample[]): OnboardingMemory {
  return foldOnboardingSamples(samples);
}

describe('onboardingStepFor: the coach beats', () => {
  it(`shows shrink only once decay alone has shrunk the cell for ${COACH_SHRINK_HOLD_SECONDS} s in a row`, () => {
    const almost = after(sample(10, SHRINKING), sample(10 + HOLD_TICKS - 1, SHRINKING));
    expect(almost.current).toBeNull();
    expect(onboardingStepFor(almost, sample(10 + HOLD_TICKS, SHRINKING)).current).toBe(ONBOARDING_BEAT.shrink);
  });

  it('restarts the shrink hold when the condition breaks (a toxin rate, a meal)', () => {
    const broken = after(sample(10, SHRINKING), sample(11), sample(12, SHRINKING));
    expect(onboardingStepFor(broken, sample(10 + HOLD_TICKS, SHRINKING)).current).toBeNull();
    expect(onboardingStepFor(broken, sample(12 + HOLD_TICKS, SHRINKING)).current).toBe(ONBOARDING_BEAT.shrink);
  });

  it(`never shows shrink in the ${COACH_SHRINK_HOLD_SECONDS} s after a respawn: the hold starts over on a new cell`, () => {
    const respawned = after(
      sample(10, SHRINKING),
      sample(11, { isAlive: false }),
      sample(12, { ...SHRINKING, cellId: RESPAWNED }),
    );
    expect(
      onboardingStepFor(respawned, sample(10 + HOLD_TICKS, { ...SHRINKING, cellId: RESPAWNED })).current,
    ).toBeNull();
    expect(onboardingStepFor(respawned, sample(12 + HOLD_TICKS, { ...SHRINKING, cellId: RESPAWNED })).current).toBe(
      ONBOARDING_BEAT.shrink,
    );
  });

  it('shows a zone beat on entering that zone, once per zone, and drops it on leaving', () => {
    const vent = after(sample(10, { zone: ZONE_ID.openBroth }), sample(11, { zone: ZONE_ID.warmVent }));
    expect(vent.current).toBe(ONBOARDING_BEAT.zoneWarmVent);
    const left = onboardingStepFor(vent, sample(12, { zone: ZONE_ID.openBroth }));
    expect(left.current).toBeNull();
    expect(onboardingStepFor(left, sample(13, { zone: ZONE_ID.warmVent })).current).toBeNull();
    expect(onboardingStepFor(left, sample(13, { zone: ZONE_ID.viscousGel })).current).toBe(
      ONBOARDING_BEAT.zoneViscousGel,
    );
  });

  it('counts a respawn inside a zone as an entry', () => {
    const inBroth = after(sample(10, { zone: ZONE_ID.openBroth }));
    const respawned = after(
      sample(10, { zone: ZONE_ID.openBroth }),
      sample(11, { isAlive: false }),
      sample(12, { zone: ZONE_ID.warmVent, cellId: RESPAWNED }),
    );
    expect(inBroth.current).toBeNull();
    expect(respawned.current).toBe(ONBOARDING_BEAT.zoneWarmVent);
  });

  it('shows the first alive snapshot of the session inside a zone as an entry, behind steer', () => {
    const memory = run(sample(1, { zone: ZONE_ID.sunlitShallows }));
    expect(memory.current).toBe(ONBOARDING_BEAT.steer);
    expect(memory.waiting).toContain(ONBOARDING_BEAT.zoneSunlitShallows);
  });

  it('shows bloom the first time the round clock is in bloom', () => {
    expect(after(sample(10, { isBloom: true })).current).toBe(ONBOARDING_BEAT.bloom);
  });

  it('lets toxin replace the pill that is up, and drops it once no toxic cell reaches', () => {
    const zone = after(sample(10, { zone: ZONE_ID.warmVent }));
    const toxin = onboardingStepFor(zone, sample(11, { zone: ZONE_ID.warmVent, isToxinReaching: true }));
    expect(toxin.current).toBe(ONBOARDING_BEAT.toxin);
    expect(toxin.seen.has(ONBOARDING_BEAT.zoneWarmVent)).toBe(true);
    expect(onboardingStepFor(toxin, sample(12, { zone: ZONE_ID.warmVent })).current).toBeNull();
  });

  it(`keeps at most ${COACH_QUEUE_MAX} coach beats waiting: a newer one drops the oldest, which can fire again`, () => {
    const bloomUp = after(sample(10, { isBloom: true }));
    const queued = [ZONE_ID.warmVent, ZONE_ID.sunlitShallows, ZONE_ID.viscousGel].reduce(
      (memory, zone, index) => onboardingStepFor(memory, sample(11 + index, { isBloom: true, zone })),
      bloomUp,
    );
    expect(queued.current).toBe(ONBOARDING_BEAT.bloom);
    expect(queued.waiting).toEqual([ONBOARDING_BEAT.zoneSunlitShallows, ONBOARDING_BEAT.zoneViscousGel]);
    expect(queued.seen.has(ONBOARDING_BEAT.zoneWarmVent)).toBe(false);
  });

  it('never drops an opening beat to make room for a coach beat', () => {
    const late = { isBloom: true, roundElapsedSeconds: SPRINT_HINT_AT_SECONDS } as const;
    const bloomUp = after(sample(10, { isBloom: true }));
    const queued = [ZONE_ID.warmVent, ZONE_ID.sunlitShallows, ZONE_ID.viscousGel].reduce(
      (memory, zone, index) => onboardingStepFor(memory, sample(11 + index, { ...late, zone })),
      bloomUp,
    );
    expect(queued.current).toBe(ONBOARDING_BEAT.bloom);
    expect(queued.waiting).toEqual([
      ONBOARDING_BEAT.sprint,
      ONBOARDING_BEAT.zoneSunlitShallows,
      ONBOARDING_BEAT.zoneViscousGel,
    ]);
  });

  it('puts a danger beat that fired under another danger beat next in line, ahead of beats waiting longer', () => {
    const queued = after(sample(10, { isBloom: true }), sample(11, { isBloom: true, zone: ZONE_ID.warmVent }));
    const threat = onboardingStepFor(queued, sample(12, { isBloom: true, zone: ZONE_ID.warmVent, hasThreat: true }));
    const toxin = onboardingStepFor(
      threat,
      sample(13, { isBloom: true, zone: ZONE_ID.warmVent, hasThreat: true, isToxinReaching: true }),
    );
    expect(toxin.current).toBe(ONBOARDING_BEAT.threat);
    expect(toxin.waiting).toEqual([ONBOARDING_BEAT.zoneWarmVent, ONBOARDING_BEAT.toxin]);
    const next = onboardingStepFor(
      toxin,
      sample(12 + HINT_TICKS, { isBloom: true, zone: ZONE_ID.warmVent, isToxinReaching: true }),
    );
    expect(next.current).toBe(ONBOARDING_BEAT.toxin);
    expect(next.waiting).toEqual([ONBOARDING_BEAT.zoneWarmVent]);
  });

  it('shows prey for a green-ringed cell in reach, with the GAIN rim', () => {
    expect(after(sample(10, { hasPreyInReach: true })).current).toBe(ONBOARDING_BEAT.prey);
    expect(COACH_BEATS.find((beat) => beat.id === ONBOARDING_BEAT.prey)?.rimColour).toBe(GAIN);
  });

  it(`keeps prey up through an engulf until it has been up ${HINT_MIN_SECONDS} s, then lets the engulf dismiss it`, () => {
    const shown = after(sample(10, { hasPreyInReach: true }));
    const early = onboardingStepFor(shown, sample(10 + secondsToTicks(0.5), { isEngulfing: true }));
    expect(early.current).toBe(ONBOARDING_BEAT.prey);
    const floorTick = 10 + secondsToTicks(HINT_MIN_SECONDS);
    expect(onboardingStepFor(early, sample(floorTick - 1, { isEngulfing: true })).current).toBe(ONBOARDING_BEAT.prey);
    expect(onboardingStepFor(early, sample(floorTick, { isEngulfing: true })).current).toBeNull();
    expect(onboardingStepFor(early, sample(floorTick, { isEngulfing: true })).seen.has(ONBOARDING_BEAT.prey)).toBe(
      true,
    );
  });

  it('drops a waiting prey beat, unseen, once the player is already engulfing when its turn comes', () => {
    const queued = after(sample(10, { isBloom: true }), sample(11, { isBloom: true, hasPreyInReach: true }));
    expect(queued.waiting).toEqual([ONBOARDING_BEAT.prey]);
    const engulfing = onboardingStepFor(queued, sample(10 + HINT_TICKS, { hasPreyInReach: true, isEngulfing: true }));
    expect(engulfing.current).toBeNull();
    expect(engulfing.seen.has(ONBOARDING_BEAT.prey)).toBe(false);
  });
});
