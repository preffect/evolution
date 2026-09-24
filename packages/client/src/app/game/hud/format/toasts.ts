// The toasts' every decision (docs/ui/overlays.md §3.6), as one pure step over snapshots: which moment fires which
// toast, what it says, and when it goes. One toast at a time, the newest replacing the one up, each for
// `TOAST_DURATION_SECONDS` of room ticks. `ToastService` carries the memory; `toast.component.ts` binds the toast.
//
// Every trigger is a change between two snapshots of the same seat, so the first snapshot of a room only remembers:
// a late joiner hears no toast for a stage it arrived at. The one toast the first snapshot can fire is `late_join`,
// which is about that snapshot. The bloom has no toast: its coach pill and the clock's caption already announce it.
// The lines are written as the coach pill's are: facts joined by ` · `, no full stop.

import {
  TRAIT_CATALOG,
  stageIndex,
  secondsToTicks,
  type BacteriumVariant,
  type CellStage,
  type OwnProgressView,
  type TraitDefinition,
  type ValueOf,
} from '@evolution/shared';
import { TOAST_DURATION_SECONDS } from '../hud-constants';

export const TOAST_KIND = {
  lateJoin: 'late_join',
  endosymbiontUnlocked: 'endosymbiont_unlocked',
  stage: 'stage',
} as const;

export type ToastKind = ValueOf<typeof TOAST_KIND>;

export interface Toast {
  readonly kind: ToastKind;
  readonly text: string;
  /** The snapshot tick it went up on; it comes down `TOAST_DURATION_SECONDS` of ticks later. */
  readonly shownAtTick: number;
}

/** The coach pill's separator (docs/ui/input-and-onboarding.md §5): a toast reads as one of its lines. */
const TOAST_FACT_SEPARATOR = ' · ';

/**
 * The `stage` toast per rung climbed to. A protocell is where every cell starts and a rematch returns to, and the
 * toast fires only on a climb, so its line is never shown.
 */
export const STAGE_TOAST_TEXT: Readonly<Record<CellStage, string>> = {
  protocell: 'You are a protocell',
  prokaryote: 'You are a prokaryote',
  endosymbiosis: ['Endosymbiosis', 'an organelle lives inside you'].join(TOAST_FACT_SEPARATOR),
  eukaryote: 'You are a eukaryote',
  specialised: 'You are a specialised cell',
};

export function lateJoinToastText(level: number, catchUpDna: number): string {
  return ['Joined late', `level ${level}`, `${Math.round(catchUpDna)} DNA catch-up`, 'pick your traits'].join(
    TOAST_FACT_SEPARATOR,
  );
}

export function endosymbiontUnlockedToastText(traitName: string): string {
  return [`${traitName} unlocked`, 'offered at your next level-up'].join(TOAST_FACT_SEPARATOR);
}

/** One snapshot as the toasts read it. */
export interface ToastSample {
  /** The room and seat the snapshot belongs to; a change starts the memory over. */
  readonly seatKey: string;
  readonly tick: number;
  /** `null` before the room names us: nothing is remembered until it does. */
  readonly ownProgress: OwnProgressView | null;
}

/** What the last sample of this seat said, and the toast that is up. */
export interface ToastMemory {
  readonly seatKey: string | null;
  readonly stage: CellStage | null;
  readonly bacteriaEatenByVariant: Readonly<Record<BacteriumVariant, number>> | null;
  readonly toast: Toast | null;
}

export const INITIAL_TOAST_MEMORY: ToastMemory = {
  seatKey: null,
  stage: null,
  bacteriaEatenByVariant: null,
  toast: null,
};

const TOAST_DURATION_TICKS = secondsToTicks(TOAST_DURATION_SECONDS);

/** The endosymbionts the catalog unlocks by eating bacteria: the only traits the unlock toast can name. */
const CATALOG: readonly TraitDefinition[] = TRAIT_CATALOG;
const ENDOSYMBIONTS: readonly TraitDefinition[] = CATALOG.filter((trait) => trait.unlockedBy !== undefined);

/** The first endosymbiont, in catalog order, whose tally reached its count between the two samples and is not owned. */
function unlockedEndosymbiont(
  previousEaten: Readonly<Record<BacteriumVariant, number>>,
  ownProgress: OwnProgressView,
): TraitDefinition | null {
  return (
    ENDOSYMBIONTS.find((trait) => {
      const unlock = trait.unlockedBy;
      if (unlock === undefined) return false;
      if (ownProgress.ownedTraits.some((owned) => owned.traitId === trait.id)) return false;
      const eaten = ownProgress.bacteriaEatenByVariant[unlock.bacteriumVariant];
      return previousEaten[unlock.bacteriumVariant] < unlock.count && eaten >= unlock.count;
    }) ?? null
  );
}

/** The toasts this sample fires against the last one of the same seat, oldest first; the last one wins. */
function firedToasts(previous: ToastMemory, sample: ToastSample, ownProgress: OwnProgressView): Toast[] {
  const toastAt = (kind: ToastKind, text: string): Toast => ({ kind, text, shownAtTick: sample.tick });
  const isFirstSample = previous.seatKey !== sample.seatKey || previous.bacteriaEatenByVariant === null;
  if (isFirstSample) {
    return ownProgress.dnaCatchUpGift > 0
      ? [toastAt(TOAST_KIND.lateJoin, lateJoinToastText(ownProgress.level, ownProgress.dnaCatchUpGift))]
      : [];
  }
  const fired: Toast[] = [];
  // A climb only: a rematch puts every cell back to a protocell (game-design/session.md §5.4), which is no news.
  if (previous.stage !== null && stageIndex(ownProgress.stage) > stageIndex(previous.stage)) {
    fired.push(toastAt(TOAST_KIND.stage, STAGE_TOAST_TEXT[ownProgress.stage]));
  }
  const unlocked = unlockedEndosymbiont(previous.bacteriaEatenByVariant, ownProgress);
  if (unlocked !== null) {
    fired.push(toastAt(TOAST_KIND.endosymbiontUnlocked, endosymbiontUnlockedToastText(unlocked.name)));
  }
  return fired;
}

/** The toast still up at `tick`: gone once its duration has run, or if the tick went back (a new room). */
function toastStillUp(toast: Toast | null, tick: number): Toast | null {
  if (toast === null) return null;
  const age = tick - toast.shownAtTick;
  return age >= 0 && age < TOAST_DURATION_TICKS ? toast : null;
}

/** One snapshot folded into the memory: the toast it fires, else the one still up. */
export function toastStepFor(previous: ToastMemory, sample: ToastSample): ToastMemory {
  const ownProgress = sample.ownProgress;
  const isSameSeat = previous.seatKey === sample.seatKey;
  const carried = isSameSeat ? previous : INITIAL_TOAST_MEMORY;
  if (ownProgress === null) return { ...carried, toast: toastStillUp(carried.toast, sample.tick) };
  const newest = firedToasts(previous, sample, ownProgress).at(-1) ?? null;
  return {
    seatKey: sample.seatKey,
    stage: ownProgress.stage,
    bacteriaEatenByVariant: ownProgress.bacteriaEatenByVariant,
    toast: newest ?? toastStillUp(carried.toast, sample.tick),
  };
}
