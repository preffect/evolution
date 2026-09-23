import { describe, expect, it } from 'vitest';
import { entityId, secondsToTicks, type EntityId } from '@evolution/shared';
import { HINT_DURATION_SECONDS, SPRINT_HINT_AT_SECONDS, STEER_HINT_DISTANCE_WU } from '../hud-constants';
import { ONBOARDING_BEAT, type OnboardingObservation } from './onboarding-beats';
import {
  INITIAL_ONBOARDING_MEMORY,
  onboardingStepFor,
  type OnboardingMemory,
  type OnboardingSample,
} from './onboarding-queue';

const OWN = entityId('own');
const RESPAWNED = entityId('own-respawned');
const HINT_TICKS = secondsToTicks(HINT_DURATION_SECONDS);

interface SampleOptions extends Partial<OnboardingObservation> {
  readonly x?: number;
  readonly cellId?: EntityId;
  readonly hasOwnEat?: boolean;
  readonly isSprinting?: boolean;
  readonly isAlive?: boolean;
}

/** An alive snapshot at `tick`, the own cell at (`x`, 0), with nothing else going on unless named. */
function sample(tick: number, options: SampleOptions = {}): OnboardingSample {
  const { x = 0, cellId = OWN, hasOwnEat = false, isSprinting = false, isAlive = true, ...facts } = options;
  return {
    tick,
    observation: isAlive
      ? {
          tick,
          roundElapsedSeconds: 0,
          dnaCumulative: 0,
          hasOffer: false,
          isProkaryote: false,
          hasThreat: false,
          ...facts,
        }
      : null,
    ownCell: isAlive ? { id: cellId, x, y: 0 } : null,
    hasOwnEat,
    isSprinting,
  };
}

/** Folds the samples in order from a fresh session. */
function run(...samples: readonly OnboardingSample[]): OnboardingMemory {
  return samples.reduce((memory, next) => onboardingStepFor(memory, next), INITIAL_ONBOARDING_MEMORY);
}

/** A session past the steer and eat beats: the cell has moved away and eaten. */
function pastOpening(): OnboardingMemory {
  return run(
    sample(1),
    sample(2, { x: STEER_HINT_DISTANCE_WU }),
    sample(3, { x: STEER_HINT_DISTANCE_WU, hasOwnEat: true }),
  );
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
      sample(10 + HINT_TICKS, { dnaCumulative: 1, isProkaryote: true, hasOffer: true }),
    );
    expect(next.current).toBe(ONBOARDING_BEAT.endosymbiosis);
    expect(next.waiting).toEqual([ONBOARDING_BEAT.offer]);
  });

  it('drops a waiting beat whose condition lapsed, unseen, so it can fire again later', () => {
    const queued = onboardingStepFor(pastOpening(), sample(10, { dnaCumulative: 1, hasOffer: true }));
    expect(queued.waiting).toEqual([ONBOARDING_BEAT.offer]);
    const lapsed = onboardingStepFor(queued, sample(10 + HINT_TICKS, { dnaCumulative: 1 }));
    expect(lapsed.current).toBeNull();
    expect(lapsed.seen.has(ONBOARDING_BEAT.offer)).toBe(false);
    expect(onboardingStepFor(lapsed, sample(20 + HINT_TICKS, { hasOffer: true })).current).toBe(ONBOARDING_BEAT.offer);
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
