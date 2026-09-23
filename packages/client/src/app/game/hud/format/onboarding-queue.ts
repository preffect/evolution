// The onboarding queue (docs/ui/input-and-onboarding.md §5): one hint at a time. A beat whose trigger fires while
// another is up waits, first in first out; a waiting beat that no longer applies when its turn comes is dropped
// unseen and may fire again later; a danger beat replaces the pill that is up, which then counts as seen. Seen-flags
// live for the session: a rematch keeps them, a reload (a fresh service) replays them.
//
// At most `COACH_QUEUE_MAX` coach beats wait: a newer one past that drops the oldest waiting coach beat, unseen.
//
// Pure: `onboardingStepFor` folds one snapshot's sample into the last memory, and the caller carries it.

import type { EntityId, ZoneId } from '@evolution/shared';
import { COACH_QUEUE_MAX } from '../hud-constants';
import { COACH_BEATS } from './onboarding-coach-beats';
import {
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
  /** The zone the own cell was in last alive snapshot; `null` after a death, so a respawn inside a zone enters it. */
  readonly lastZone: ZoneId | null;
}

/** Every beat §5 lists: the opening rows in table order, then the coach rows. */
export const ONBOARDING_BEATS: readonly OnboardingBeat[] = [...OPENING_BEATS, ...COACH_BEATS];

const NO_BEATS: readonly OnboardingBeatId[] = [];

export const INITIAL_ONBOARDING_MEMORY: OnboardingMemory = {
  lastTick: Number.NEGATIVE_INFINITY,
  seen: new Set(),
  current: null,
  waiting: NO_BEATS,
  history: {
    travelSinceShownWu: 0,
    hasEaten: false,
    hasSprinted: false,
    shownAtTick: 0,
    shrinkSinceTick: null,
    enteredZone: null,
  },
  lastPosition: null,
  lastZone: null,
};

function travelledWu(memory: OnboardingMemory, sample: OnboardingSample): number {
  const last = memory.lastPosition;
  const own = sample.ownCell;
  // A new own cell (a respawn) starts somewhere else: the jump is not travel.
  if (last === null || own === null || last.id !== own.id) return 0;
  return Math.hypot(own.x - last.x, own.y - last.y);
}

/** Since when decay alone has been shrinking this own cell; a new own cell (a respawn) starts the hold over. */
function shrinkSinceTickAfter(memory: OnboardingMemory, sample: OnboardingSample): number | null {
  if (sample.observation?.isShrinkingFromDecay !== true) return null;
  const isSameCell = memory.lastPosition !== null && memory.lastPosition.id === sample.ownCell?.id;
  return (isSameCell ? memory.history.shrinkSinceTick : null) ?? sample.tick;
}

/** The zone entered this snapshot: a change of zone, or the first alive snapshot of a (re)spawn inside one. */
function enteredZoneOf(memory: OnboardingMemory, sample: OnboardingSample): ZoneId | null {
  const zone = sample.observation?.zone ?? null;
  const isSameCell = memory.lastPosition !== null && memory.lastPosition.id === sample.ownCell?.id;
  return zone !== null && (zone !== memory.lastZone || !isSameCell) ? zone : null;
}

/** The history and position folded forward by one snapshot, before any beat is decided. */
function historyAfter(memory: OnboardingMemory, sample: OnboardingSample): OnboardingMemory {
  const history = memory.history;
  return {
    ...memory,
    lastTick: sample.tick,
    lastPosition: sample.ownCell,
    lastZone: sample.observation?.zone ?? null,
    history: {
      ...history,
      travelSinceShownWu: history.travelSinceShownWu + travelledWu(memory, sample),
      hasEaten: history.hasEaten || sample.hasOwnEat,
      hasSprinted: history.hasSprinted || sample.isSprinting,
      shrinkSinceTick: shrinkSinceTickAfter(memory, sample),
      enteredZone: enteredZoneOf(memory, sample),
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

/**
 * The next beat to go up: a waiting danger beat first (one that fired while another danger beat was up), else the
 * first waiting beat; either way the first that still applies. The lapsed ones passed over are dropped unseen.
 */
function nextFromQueue(
  memory: OnboardingMemory,
  observation: OnboardingObservation,
  beatsById: ReadonlyMap<OnboardingBeatId, OnboardingBeat>,
): OnboardingMemory {
  const isDanger = (id: OnboardingBeatId): boolean => beatsById.get(id)?.isDanger === true;
  const inTurn = [...memory.waiting.filter(isDanger), ...memory.waiting.filter((id) => !isDanger(id))];
  const lapsed = new Set<OnboardingBeatId>();
  for (const id of inTurn) {
    if (beatsById.get(id)?.isStillWanted(observation, memory.history)) {
      const waiting = memory.waiting.filter((other) => other !== id && !lapsed.has(other));
      return show({ ...memory, waiting }, id, observation.tick);
    }
    lapsed.add(id);
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

/** The waiting list with `beat` at its end; past `COACH_QUEUE_MAX` waiting coach beats the oldest one goes, unseen. */
function waitingWith(
  waiting: readonly OnboardingBeatId[],
  beat: OnboardingBeat,
  beatsById: ReadonlyMap<OnboardingBeatId, OnboardingBeat>,
): readonly OnboardingBeatId[] {
  const isCoach = (id: OnboardingBeatId): boolean => beatsById.get(id)?.isCoach === true;
  const coachWaiting = waiting.filter(isCoach);
  if (!beat.isCoach || coachWaiting.length < COACH_QUEUE_MAX) return [...waiting, beat.id];
  const oldestCoach = coachWaiting[0];
  return [...waiting.filter((id) => id !== oldestCoach), beat.id];
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
  return { ...memory, waiting: waitingWith(memory.waiting, beat, beatsById) };
}

/** Folds one snapshot into the queue; a tick already seen changes nothing, so a recomputation never counts twice. */
export function onboardingStepFor(
  previous: OnboardingMemory,
  sample: OnboardingSample,
  beats: readonly OnboardingBeat[] = ONBOARDING_BEATS,
): OnboardingMemory {
  if (sample.tick <= previous.lastTick) return previous;
  const observation = sample.observation;
  // Dead, spectating or between rounds: nothing fires and nothing is dismissed; the pill waits with the player.
  if (observation === null) return historyAfter(previous, sample);
  const beatsById = new Map(beats.map((beat) => [beat.id, beat]));
  let memory = afterDismissal(historyAfter(previous, sample), observation, beatsById);
  for (const beat of newlyTriggered(memory, observation, beats)) {
    memory = enqueue(memory, beat, observation.tick, beatsById);
  }
  return memory.current === null ? nextFromQueue(memory, observation, beatsById) : memory;
}
