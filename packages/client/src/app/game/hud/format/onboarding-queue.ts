// The onboarding queue (docs/ui/input-and-onboarding.md §5): one hint at a time. A beat whose trigger fires while
// another is up waits, first in first out; a waiting beat that no longer applies when its turn comes is dropped
// unseen and may fire again later; a danger beat replaces the pill that is up, which then counts as seen. Seen-flags
// live for the session: a rematch keeps them, a reload (a fresh service) replays them.
//
// Pure: `onboardingStepFor` folds one snapshot's sample into the last memory, and the caller carries it.

import type { EntityId } from '@evolution/shared';
import {
  ONBOARDING_BEAT,
  OPENING_BEATS,
  type OnboardingBeat,
  type OnboardingBeatId,
  type OnboardingHistory,
  type OnboardingObservation,
} from './onboarding-beats';

/** Where the own cell is; the id tells a respawn's jump from travel. */
export interface OnboardingPosition {
  readonly id: EntityId;
  readonly x: number;
  readonly y: number;
}

/** One snapshot, as the queue samples it; `observation` is `null` while there is no own cell alive in play. */
export interface OnboardingSample {
  readonly tick: number;
  readonly observation: OnboardingObservation | null;
  readonly ownCell: OnboardingPosition | null;
  /** An `eat` effect in this snapshot names the own cell. */
  readonly hasOwnEat: boolean;
  readonly isSprinting: boolean;
}

export interface OnboardingMemory {
  readonly lastTick: number;
  readonly seen: ReadonlySet<OnboardingBeatId>;
  /** The beat on screen, or `null`. */
  readonly current: OnboardingBeatId | null;
  readonly waiting: readonly OnboardingBeatId[];
  readonly history: OnboardingHistory;
  /** Where the own cell was last snapshot, to measure the steer beat's travel; `null` with no own cell. */
  readonly lastPosition: OnboardingPosition | null;
}

const NO_BEATS: readonly OnboardingBeatId[] = [];

export const INITIAL_ONBOARDING_MEMORY: OnboardingMemory = {
  lastTick: Number.NEGATIVE_INFINITY,
  seen: new Set(),
  current: null,
  waiting: NO_BEATS,
  history: { travelSinceShownWu: 0, hasEaten: false, hasSprinted: false, shownAtTick: 0 },
  lastPosition: null,
};

function travelledWu(memory: OnboardingMemory, sample: OnboardingSample): number {
  const last = memory.lastPosition;
  const own = sample.ownCell;
  // A new own cell (a respawn) starts somewhere else: the jump is not travel.
  if (last === null || own === null || last.id !== own.id) return 0;
  return Math.hypot(own.x - last.x, own.y - last.y);
}

/** The history and position folded forward by one snapshot, before any beat is decided. */
function historyAfter(memory: OnboardingMemory, sample: OnboardingSample): OnboardingMemory {
  const history = memory.history;
  return {
    ...memory,
    lastTick: sample.tick,
    lastPosition: sample.ownCell,
    history: {
      ...history,
      travelSinceShownWu: history.travelSinceShownWu + travelledWu(memory, sample),
      hasEaten: history.hasEaten || sample.hasOwnEat,
      hasSprinted: history.hasSprinted || sample.isSprinting,
    },
  };
}

function show(memory: OnboardingMemory, id: OnboardingBeatId, tick: number): OnboardingMemory {
  return {
    ...memory,
    current: id,
    seen: new Set([...memory.seen, id]),
    history: { ...memory.history, shownAtTick: tick, travelSinceShownWu: 0 },
  };
}

/** The beats that fired this snapshot and are neither seen, up nor already waiting, in `beats` order. */
function newlyTriggered(
  memory: OnboardingMemory,
  observation: OnboardingObservation,
  beats: readonly OnboardingBeat[],
): readonly OnboardingBeat[] {
  return beats.filter(
    (beat) =>
      !memory.seen.has(beat.id) &&
      !memory.waiting.includes(beat.id) &&
      beat.isTriggered(observation, memory.history, memory.seen),
  );
}

/** The first waiting beat that still applies goes up; the lapsed ones before it are dropped unseen. */
function nextFromQueue(
  memory: OnboardingMemory,
  observation: OnboardingObservation,
  beatsById: ReadonlyMap<OnboardingBeatId, OnboardingBeat>,
): OnboardingMemory {
  for (const [index, id] of memory.waiting.entries()) {
    if (beatsById.get(id)?.isStillWanted(observation, memory.history)) {
      return show({ ...memory, waiting: memory.waiting.slice(index + 1) }, id, observation.tick);
    }
  }
  return { ...memory, waiting: NO_BEATS };
}

/** The beat on screen comes down once its dismissal holds. */
function afterDismissal(
  memory: OnboardingMemory,
  observation: OnboardingObservation,
  beatsById: ReadonlyMap<OnboardingBeatId, OnboardingBeat>,
): OnboardingMemory {
  const current = memory.current === null ? undefined : beatsById.get(memory.current);
  return current?.isDismissed(observation, memory.history) ? { ...memory, current: null } : memory;
}

/** A danger beat jumps the queue and the pill (unless a danger beat is up); every other beat queues behind the rest. */
function enqueue(
  memory: OnboardingMemory,
  beat: OnboardingBeat,
  tick: number,
  beatsById: ReadonlyMap<OnboardingBeatId, OnboardingBeat>,
): OnboardingMemory {
  const isCurrentDanger = memory.current !== null && beatsById.get(memory.current)?.isDanger === true;
  if (beat.isDanger && !isCurrentDanger) return show(memory, beat.id, tick);
  return { ...memory, waiting: [...memory.waiting, beat.id] };
}

/**
 * The first offer's line goes up at once; the beat it displaces goes back to the front of the queue, unseen, since
 * the picker hid it before it was read.
 */
function showOfferBeat(memory: OnboardingMemory, tick: number): OnboardingMemory {
  const displaced = memory.current;
  const seen = new Set(memory.seen);
  if (displaced !== null) seen.delete(displaced);
  const others = memory.waiting.filter((id) => id !== ONBOARDING_BEAT.offer);
  return show(
    { ...memory, seen, waiting: displaced === null ? others : [displaced, ...others] },
    ONBOARDING_BEAT.offer,
    tick,
  );
}

/**
 * While the picker is open it owns the words (docs/ui/input-and-onboarding.md §5): only the `offer` beat goes up.
 * Every other beat that fires waits, danger beats included, and a hidden beat's timer holds until the pick.
 */
function stepWhilePicking(
  previous: OnboardingMemory,
  memory: OnboardingMemory,
  observation: OnboardingObservation,
  beats: readonly OnboardingBeat[],
): OnboardingMemory {
  let next = memory;
  if (!next.seen.has(ONBOARDING_BEAT.offer)) next = showOfferBeat(next, observation.tick);
  else if (next.current !== ONBOARDING_BEAT.offer && Number.isFinite(previous.lastTick)) {
    const heldTicks = observation.tick - previous.lastTick;
    next = { ...next, history: { ...next.history, shownAtTick: next.history.shownAtTick + heldTicks } };
  }
  const waiting = [...next.waiting];
  for (const beat of newlyTriggered(next, observation, beats)) waiting.push(beat.id);
  return { ...next, waiting };
}

/** Folds one snapshot into the queue; a tick already seen changes nothing, so a recomputation never counts twice. */
export function onboardingStepFor(
  previous: OnboardingMemory,
  sample: OnboardingSample,
  beats: readonly OnboardingBeat[] = OPENING_BEATS,
): OnboardingMemory {
  if (sample.tick <= previous.lastTick) return previous;
  const observation = sample.observation;
  // Dead, spectating or between rounds: nothing fires and nothing is dismissed; the pill waits with the player.
  if (observation === null) return historyAfter(previous, sample);
  if (observation.hasOffer) return stepWhilePicking(previous, historyAfter(previous, sample), observation, beats);
  const beatsById = new Map(beats.map((beat) => [beat.id, beat]));
  let memory = afterDismissal(historyAfter(previous, sample), observation, beatsById);
  for (const beat of newlyTriggered(memory, observation, beats)) {
    memory = enqueue(memory, beat, observation.tick, beatsById);
  }
  return memory.current === null ? nextFromQueue(memory, observation, beatsById) : memory;
}
