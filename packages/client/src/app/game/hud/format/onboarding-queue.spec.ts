// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { secondsToTicks } from '@evolution/shared';
import {
  TEST_ONBOARDING_RESPAWNED_CELL_ID as RESPAWNED,
  createTestOnboardingSample as sample,
  foldOnboardingSamples,
  onboardingPastOpening as pastOpening,
} from '../../../../testing/onboarding-builders';
import { HINT_DURATION_SECONDS, SPRINT_HINT_AT_SECONDS, STEER_HINT_DISTANCE_WU } from '../hud-constants';
import { ONBOARDING_BEAT } from './onboarding-beats';
import { onboardingStepFor, type OnboardingMemory, type OnboardingSample } from './onboarding-queue';

const HINT_TICKS = secondsToTicks(HINT_DURATION_SECONDS);

/** Folds the samples in order from a fresh session. */
function run(...samples: readonly OnboardingSample[]): OnboardingMemory {
  return foldOnboardingSamples(samples);
}

describe('onboardingStepFor: the opening beats', () => {
  it('shows steer on the first alive snapshot, and nothing before it', () => {
    expect(run(sample(1, { isAlive: false })).current).toBeNull();
    expect(run(sample(1, { isAlive: false }), sample(2)).current).toBe(ONBOARDING_BEAT.steer);
  });

  it(`keeps steer up until the cell has travelled ${STEER_HINT_DISTANCE_WU} wu, however long that takes`, () => {
    const slow = run(
      sample(1),
      sample(2, { x: STEER_HINT_DISTANCE_WU - 1 }),
      sample(HINT_TICKS * 10, { x: STEER_HINT_DISTANCE_WU - 1 }),
    );
    expect(slow.current).toBe(ONBOARDING_BEAT.steer);
    expect(onboardingStepFor(slow, sample(HINT_TICKS * 10 + 1, { x: STEER_HINT_DISTANCE_WU })).current).not.toBe(
      ONBOARDING_BEAT.steer,
    );
  });

  it('does not count a respawn’s jump to a new cell as travel', () => {
    const memory = run(sample(1), sample(2, { cellId: RESPAWNED, x: STEER_HINT_DISTANCE_WU * 5 }));
    expect(memory.current).toBe(ONBOARDING_BEAT.steer);
  });

  it('shows eat after steer and holds it until the first own eat', () => {
    const afterSteer = run(sample(1), sample(2, { x: STEER_HINT_DISTANCE_WU }));
    expect(afterSteer.current).toBe(ONBOARDING_BEAT.eat);
    const later = onboardingStepFor(afterSteer, sample(HINT_TICKS * 10, { x: STEER_HINT_DISTANCE_WU }));
    expect(later.current).toBe(ONBOARDING_BEAT.eat);
    expect(onboardingStepFor(later, sample(HINT_TICKS * 10 + 1, { hasOwnEat: true })).current).toBeNull();
  });

  it('never shows eat when the player ate while steer was up', () => {
    const memory = run(sample(1), sample(2, { hasOwnEat: true }), sample(3, { x: STEER_HINT_DISTANCE_WU }));
    expect(memory.current).toBeNull();
    expect(memory.seen.has(ONBOARDING_BEAT.eat)).toBe(false);
  });

  it(`shows dna on the first DNA and drops it after ${HINT_DURATION_SECONDS} s`, () => {
    const shown = onboardingStepFor(pastOpening(), sample(10, { dnaCumulative: 1 }));
    expect(shown.current).toBe(ONBOARDING_BEAT.dna);
    expect(onboardingStepFor(shown, sample(10 + HINT_TICKS - 1, { dnaCumulative: 1 })).current).toBe(
      ONBOARDING_BEAT.dna,
    );
    expect(onboardingStepFor(shown, sample(10 + HINT_TICKS, { dnaCumulative: 1 })).current).toBeNull();
  });

  it(`shows sprint at ${SPRINT_HINT_AT_SECONDS} s of round time if never sprinted, and a sprint dismisses it`, () => {
    const early = onboardingStepFor(pastOpening(), sample(10, { roundElapsedSeconds: SPRINT_HINT_AT_SECONDS - 1 }));
    expect(early.current).toBeNull();
    const shown = onboardingStepFor(early, sample(11, { roundElapsedSeconds: SPRINT_HINT_AT_SECONDS }));
    expect(shown.current).toBe(ONBOARDING_BEAT.sprint);
    expect(onboardingStepFor(shown, sample(12, { isSprinting: true })).current).toBeNull();
  });

  it('never shows sprint to a player who has already sprinted', () => {
    const sprinted = onboardingStepFor(pastOpening(), sample(10, { isSprinting: true }));
    expect(onboardingStepFor(sprinted, sample(11, { roundElapsedSeconds: SPRINT_HINT_AT_SECONDS })).current).toBeNull();
  });

  it('holds the offer beat while the offer is open and drops it on the pick or the timeout', () => {
    const shown = onboardingStepFor(pastOpening(), sample(10, { hasOffer: true }));
    expect(shown.current).toBe(ONBOARDING_BEAT.offer);
    expect(onboardingStepFor(shown, sample(10 + HINT_TICKS * 3, { hasOffer: true })).current).toBe(
      ONBOARDING_BEAT.offer,
    );
    expect(onboardingStepFor(shown, sample(11)).current).toBeNull();
  });

  it('shows endosymbiosis when the stage becomes prokaryote, on the timer', () => {
    const shown = onboardingStepFor(pastOpening(), sample(10, { isProkaryote: true }));
    expect(shown.current).toBe(ONBOARDING_BEAT.endosymbiosis);
    expect(onboardingStepFor(shown, sample(10 + HINT_TICKS, { isProkaryote: true })).current).toBeNull();
  });

  it('shows each beat once a session: a later trigger of a seen beat shows nothing', () => {
    const done = onboardingStepFor(
      onboardingStepFor(pastOpening(), sample(10, { dnaCumulative: 1 })),
      sample(10 + HINT_TICKS, { dnaCumulative: 1 }),
    );
    expect(onboardingStepFor(done, sample(10 + HINT_TICKS + 1, { dnaCumulative: 5 })).current).toBeNull();
  });
});

describe('onboardingStepFor: the queue', () => {
  it('shows beats that fire together one at a time, in table order', () => {
    const together = onboardingStepFor(pastOpening(), sample(10, { dnaCumulative: 1, isProkaryote: true }));
    expect(together.current).toBe(ONBOARDING_BEAT.dna);
    expect(together.waiting).toEqual([ONBOARDING_BEAT.endosymbiosis]);
    const next = onboardingStepFor(together, sample(10 + HINT_TICKS, { dnaCumulative: 1, isProkaryote: true }));
    expect(next.current).toBe(ONBOARDING_BEAT.endosymbiosis);
  });

  it('keeps first in first out when a new beat fires on the tick the pill comes down', () => {
    const queued = onboardingStepFor(pastOpening(), sample(10, { dnaCumulative: 1, isProkaryote: true }));
    const next = onboardingStepFor(
      queued,
      sample(10 + HINT_TICKS, { dnaCumulative: 1, isProkaryote: true, roundElapsedSeconds: SPRINT_HINT_AT_SECONDS }),
    );
    expect(next.current).toBe(ONBOARDING_BEAT.endosymbiosis);
    expect(next.waiting).toEqual([ONBOARDING_BEAT.sprint]);
  });

  it('drops a waiting beat whose condition lapsed, unseen, so it can fire again later', () => {
    const queued = onboardingStepFor(pastOpening(), sample(10, { dnaCumulative: 1, isProkaryote: true }));
    expect(queued.waiting).toEqual([ONBOARDING_BEAT.endosymbiosis]);
    const lapsed = onboardingStepFor(queued, sample(10 + HINT_TICKS, { dnaCumulative: 1 }));
    expect(lapsed.current).toBeNull();
    expect(lapsed.seen.has(ONBOARDING_BEAT.endosymbiosis)).toBe(false);
    expect(onboardingStepFor(lapsed, sample(20 + HINT_TICKS, { isProkaryote: true })).current).toBe(
      ONBOARDING_BEAT.endosymbiosis,
    );
  });

  it('lets threat replace the pill that is up at once; the replaced beat counts as seen', () => {
    const steer = run(sample(1));
    const threat = onboardingStepFor(steer, sample(2, { hasThreat: true }));
    expect(threat.current).toBe(ONBOARDING_BEAT.threat);
    expect(threat.seen.has(ONBOARDING_BEAT.steer)).toBe(true);
    expect(onboardingStepFor(threat, sample(2 + HINT_TICKS)).current).toBe(ONBOARDING_BEAT.eat);
  });

  it('lets threat jump beats already waiting, which then keep their order behind it', () => {
    const queued = onboardingStepFor(pastOpening(), sample(10, { dnaCumulative: 1, isProkaryote: true }));
    const threat = onboardingStepFor(queued, sample(11, { dnaCumulative: 1, isProkaryote: true, hasThreat: true }));
    expect(threat.current).toBe(ONBOARDING_BEAT.threat);
    expect(threat.waiting).toEqual([ONBOARDING_BEAT.endosymbiosis]);
  });

  it('fires nothing and dismisses nothing while the player is not alive in play', () => {
    const dead = run(sample(1), sample(2, { isAlive: false }));
    expect(dead.current).toBe(ONBOARDING_BEAT.steer);
    expect(onboardingStepFor(pastOpening(), sample(10, { isAlive: false, hasThreat: true })).current).toBeNull();
  });

  it('ignores a snapshot it has already folded, so a recomputation never counts twice', () => {
    const memory = run(sample(1), sample(2, { x: STEER_HINT_DISTANCE_WU / 2 }));
    expect(onboardingStepFor(memory, sample(2, { x: STEER_HINT_DISTANCE_WU }))).toBe(memory);
  });
});

describe('onboardingStepFor: while the picker is open', () => {
  const offerClosedAt = 10 + HINT_TICKS * 3;

  /** A session past the opening beats and its first offer, so a later offer carries no beat of its own. */
  function pastFirstOffer(): OnboardingMemory {
    return run(
      sample(1),
      sample(2, { x: STEER_HINT_DISTANCE_WU }),
      sample(3, { hasOwnEat: true }),
      sample(4, { hasOffer: true }),
      sample(5),
    );
  }

  it('shows sprint that fired behind an open picker after the pick, not behind the picker', () => {
    const picking = onboardingStepFor(
      pastFirstOffer(),
      sample(10, { hasOffer: true, roundElapsedSeconds: SPRINT_HINT_AT_SECONDS }),
    );
    const stillPicking = onboardingStepFor(
      picking,
      sample(10 + HINT_TICKS * 2, { hasOffer: true, roundElapsedSeconds: SPRINT_HINT_AT_SECONDS }),
    );
    expect(stillPicking.current).toBeNull();
    expect(stillPicking.seen.has(ONBOARDING_BEAT.sprint)).toBe(false);
    const picked = onboardingStepFor(
      stillPicking,
      sample(offerClosedAt, { roundElapsedSeconds: SPRINT_HINT_AT_SECONDS }),
    );
    expect(picked.current).toBe(ONBOARDING_BEAT.sprint);
  });

  it('holds a threat behind the open picker and shows it after the pick while the threat is still there', () => {
    const offerUp = onboardingStepFor(pastOpening(), sample(10, { hasOffer: true }));
    const threatened = onboardingStepFor(offerUp, sample(11, { hasOffer: true, hasThreat: true }));
    expect(threatened.current).toBe(ONBOARDING_BEAT.offer);
    expect(threatened.waiting).toEqual([ONBOARDING_BEAT.threat]);
    expect(onboardingStepFor(threatened, sample(offerClosedAt, { hasThreat: true })).current).toBe(
      ONBOARDING_BEAT.threat,
    );
    expect(onboardingStepFor(threatened, sample(offerClosedAt)).current).toBeNull();
  });

  it('puts the first offer’s beat up over a dna pill, which resumes after the pick, unseen until then', () => {
    const dna = onboardingStepFor(pastOpening(), sample(10, { dnaCumulative: 1 }));
    const offer = onboardingStepFor(dna, sample(11, { dnaCumulative: 1, hasOffer: true }));
    expect(offer.current).toBe(ONBOARDING_BEAT.offer);
    expect(offer.waiting).toEqual([ONBOARDING_BEAT.dna]);
    expect(offer.seen.has(ONBOARDING_BEAT.dna)).toBe(false);
    const picked = onboardingStepFor(offer, sample(offerClosedAt, { dnaCumulative: 1 }));
    expect(picked.current).toBe(ONBOARDING_BEAT.dna);
  });

  it('holds the timer of a beat the picker hides, so it still has its time on screen after the pick', () => {
    const dna = onboardingStepFor(pastFirstOffer(), sample(10, { dnaCumulative: 1 }));
    const hidden = onboardingStepFor(dna, sample(10 + HINT_TICKS * 2, { dnaCumulative: 1, hasOffer: true }));
    const picked = onboardingStepFor(hidden, sample(10 + HINT_TICKS * 2 + 1, { dnaCumulative: 1 }));
    expect(picked.current).toBe(ONBOARDING_BEAT.dna);
  });
});
