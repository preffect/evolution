// The onboarding beats (docs/ui/input-and-onboarding.md §5): each beat's id, when it fires, whether a waiting beat
// still applies, and what dismisses it once it is up. The queue that orders them is `onboarding-queue.ts`; what the
// pill says is `onboarding-text.ts`. Pure: every answer reads one snapshot's facts and the queue's memory.

import { ticksToSeconds, type ValueOf } from '@evolution/shared';
import { HINT_DURATION_SECONDS, SPRINT_HINT_AT_SECONDS, STEER_HINT_DISTANCE_WU } from '../hud-constants';

/** The `data-hint-id` of every beat, in §5's table order. */
export const ONBOARDING_BEAT = {
  steer: 'steer',
  eat: 'eat',
  dna: 'dna',
  sprint: 'sprint',
  offer: 'offer',
  endosymbiosis: 'endosymbiosis',
  threat: 'threat',
} as const;
export type OnboardingBeatId = ValueOf<typeof ONBOARDING_BEAT>;

/** One alive snapshot's facts, as the beats read them. */
export interface OnboardingObservation {
  readonly tick: number;
  /** Seconds since the round started (`tick − roundStartTick`). */
  readonly roundElapsedSeconds: number;
  readonly dnaCumulative: number;
  readonly hasOffer: boolean;
  readonly isProkaryote: boolean;
  /** `ownCellIndicators.nearestThreat` is set. */
  readonly hasThreat: boolean;
}

/** What the queue remembers across snapshots that a beat's rule reads. */
export interface OnboardingHistory {
  /** Distance the own cell has moved since the beat on screen went up, in world units. */
  readonly travelSinceShownWu: number;
  readonly hasEaten: boolean;
  readonly hasSprinted: boolean;
  /** The tick the beat on screen went up. */
  readonly shownAtTick: number;
}

/** A beat's three rules; `isStillWanted` also gates a waiting beat's turn (a lapsed one is dropped unseen). */
export interface OnboardingBeat {
  readonly id: OnboardingBeatId;
  /** `threat` (and #388's `toxin`) replace the pill that is up at once rather than waiting. */
  readonly isDanger: boolean;
  isTriggered(
    observation: OnboardingObservation,
    history: OnboardingHistory,
    seen: ReadonlySet<OnboardingBeatId>,
  ): boolean;
  isStillWanted(observation: OnboardingObservation, history: OnboardingHistory): boolean;
  isDismissed(observation: OnboardingObservation, history: OnboardingHistory): boolean;
}

/** The pill has been up `HINT_DURATION_SECONDS`. */
export function isHintTimeUp(observation: OnboardingObservation, history: OnboardingHistory): boolean {
  return ticksToSeconds(observation.tick - history.shownAtTick) >= HINT_DURATION_SECONDS;
}

const ALWAYS = (): boolean => true;

/** A beat that fires on one condition, stays wanted while it holds and goes on the timer. */
function timedBeat(
  id: OnboardingBeatId,
  holds: (observation: OnboardingObservation) => boolean,
  isDanger = false,
): OnboardingBeat {
  return { id, isDanger, isTriggered: holds, isStillWanted: holds, isDismissed: isHintTimeUp };
}

/** §5's opening rows, in table order: the order they show in when several fire together. */
export const OPENING_BEATS: readonly OnboardingBeat[] = [
  {
    id: ONBOARDING_BEAT.steer,
    isDanger: false,
    // The first alive snapshot of the session: the queue only asks on alive snapshots.
    isTriggered: ALWAYS,
    isStillWanted: ALWAYS,
    isDismissed: (_observation, history) => history.travelSinceShownWu >= STEER_HINT_DISTANCE_WU,
  },
  {
    id: ONBOARDING_BEAT.eat,
    isDanger: false,
    isTriggered: (_observation, history, seen) => seen.has(ONBOARDING_BEAT.steer) && !history.hasEaten,
    isStillWanted: (_observation, history) => !history.hasEaten,
    isDismissed: (_observation, history) => history.hasEaten,
  },
  timedBeat(ONBOARDING_BEAT.dna, (observation) => observation.dnaCumulative > 0),
  {
    id: ONBOARDING_BEAT.sprint,
    isDanger: false,
    isTriggered: (observation, history) =>
      observation.roundElapsedSeconds >= SPRINT_HINT_AT_SECONDS && !history.hasSprinted,
    isStillWanted: (_observation, history) => !history.hasSprinted,
    isDismissed: (observation, history) => history.hasSprinted || isHintTimeUp(observation, history),
  },
  {
    id: ONBOARDING_BEAT.offer,
    isDanger: false,
    isTriggered: (observation) => observation.hasOffer,
    isStillWanted: (observation) => observation.hasOffer,
    // A pick or the timeout closes the offer; the line goes with the picker.
    isDismissed: (observation) => !observation.hasOffer,
  },
  timedBeat(ONBOARDING_BEAT.endosymbiosis, (observation) => observation.isProkaryote),
  timedBeat(ONBOARDING_BEAT.threat, (observation) => observation.hasThreat, true),
];
