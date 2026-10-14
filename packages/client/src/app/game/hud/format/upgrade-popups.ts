// The upgrade popups' every decision (docs/ui/overlays.md §3.8, #783), as one pure step over snapshots: which trait
// gained or tier up fires which popup, what it says, and when it is up. A trait the own cell did not hold, or holds at
// a higher tier than the last snapshot said, fires an upgrade popup; a form (the rung-5 gates, `form-facts.ts`) gained
// fires the larger form popup with its real-life line instead. The text is a picker card's (`traitCardViewFor`):
// the catalog's name, the tier numeral and the tier row's effect lines with their tones, so no number is typed. A giant
// the own cell swallowed fires the giant popup, as large as a form's (`giant-popups.ts`): an event the bus reported
// rather than a change between two snapshots, so each swallow after the last folded tick fires once, never on a
// recomputation, however many snapshots landed since that fold.
//
// Popups queue rather than stack: one is up at a time, each for its kind's duration in room ticks, and a popup fired
// while another is up or waiting starts when the last one ends. While the one up is held (the picker open over a big
// cell, ticket #863) its life stops: it and every popup behind it end that much later. Every trigger is a change between two snapshots of the
// same seat, like the toasts' (§3.6): the first snapshot of a seat only remembers, so a late joiner's traits and a
// reconnect fire nothing, and a rematch, which empties the traits, gains nothing. `UpgradePopupService` carries the
// memory; `upgrade-popup.component.ts` binds the popup that is up.

import { CELL_STAGE, secondsToTicks, type OwnProgressView, type OwnedTrait } from '@evolution/shared';
import { FORM_POPUP_DURATION_SECONDS, UPGRADE_POPUP_DURATION_SECONDS } from '../upgrade-popup-constants';
import { formRealLifeLine, isFormTrait } from './form-facts';
import { giantPopupsIn, type GiantSwallow } from './giant-popups';
import {
  UPGRADE_POPUP_KIND,
  type UpgradePopup,
  type UpgradePopupContent,
  type UpgradePopupKind,
} from './upgrade-popup-kinds';
import { traitCardViewFor } from './trait-cards';
import type { TraitModifierTables } from './trait-effects';

/** The form popup's kicker above the name: it names the moment. */
export const FORM_POPUP_KICKER_TEXT = 'NEW FORM';

/** One snapshot as the popups read it. */
export interface UpgradePopupSample {
  /** The room and seat the snapshot belongs to; a change starts the memory over. */
  readonly seatKey: string;
  readonly tick: number;
  /** `null` before the room names us: nothing is remembered until it does. */
  readonly ownProgress: OwnProgressView | null;
  /** The live balance's tier tables; `null` before the room sends it, when a sample only remembers. */
  readonly traits: TraitModifierTables | null;
  /** The own cell's giant swallows not yet past (`withGiantSwallow`); only those after the last fold fire. */
  readonly giantSwallows: readonly GiantSwallow[];
  /** The popup up is held off screen (`UPGRADE_POPUP_PLACEMENT.held`): the ticks since the last fold do not count. */
  readonly isUpPopupHeld: boolean;
}

/** What the last sample of this seat held, and the popups up or waiting, oldest first. */
export interface UpgradePopupMemory {
  readonly seatKey: string | null;
  readonly tick: number | null;
  readonly ownedTraits: readonly OwnedTrait[] | null;
  readonly queue: readonly UpgradePopup[];
}

export const INITIAL_UPGRADE_POPUP_MEMORY: UpgradePopupMemory = {
  seatKey: null,
  tick: null,
  ownedTraits: null,
  queue: [],
};

const DURATION_TICKS: Readonly<Record<UpgradePopupKind, number>> = {
  upgrade: secondsToTicks(UPGRADE_POPUP_DURATION_SECONDS),
  form: secondsToTicks(FORM_POPUP_DURATION_SECONDS),
  // The giant popup is drawn as a form popup, whose fade the stylesheet times to the form's life.
  giant: secondsToTicks(FORM_POPUP_DURATION_SECONDS),
};

/** The owned traits that are new since `previous`, or a tier above what it held, in the snapshot's order. */
export function gainedTraits(previous: readonly OwnedTrait[], current: readonly OwnedTrait[]): OwnedTrait[] {
  return current.filter((owned) => {
    const before = previous.find((trait) => trait.traitId === owned.traitId);
    return before === undefined || owned.tier > before.tier;
  });
}

/** The popup `gained` fires, `wasOwned` telling a tier up from a trait new to the cell. Its ticks are set by the queue. */
export function upgradePopupFor(
  gained: OwnedTrait,
  wasOwned: boolean,
  traits: TraitModifierTables,
): UpgradePopupContent {
  // The card's view: the stage only decides the RUNG ribbon, which a popup does not show.
  const card = traitCardViewFor(gained, 0, { ownedTraits: [], stage: CELL_STAGE.protocell }, traits);
  const isForm = !wasOwned && isFormTrait(gained.traitId);
  return {
    kind: isForm ? UPGRADE_POPUP_KIND.form : UPGRADE_POPUP_KIND.upgrade,
    kicker: isForm ? FORM_POPUP_KICKER_TEXT : null,
    traitId: gained.traitId,
    giantSpecies: null,
    title: `${card.name} ${card.tierLabel}`,
    effects: card.effects,
    effectTones: card.effectTones,
    realLifeLine: isForm ? formRealLifeLine(gained.traitId) : null,
  };
}

/** `fired` appended to `queue`, each starting when the one before it ends, or at `tick` if nothing is left by then. */
function enqueue(queue: readonly UpgradePopup[], fired: readonly UpgradePopupContent[], tick: number): UpgradePopup[] {
  const queued = [...queue];
  for (const popup of fired) {
    const startTick = Math.max(tick, queued.at(-1)?.endTick ?? tick);
    queued.push({
      ...popup,
      key: `${popup.traitId ?? popup.giantSpecies}@${startTick}`,
      startTick,
      endTick: startTick + DURATION_TICKS[popup.kind],
    });
  }
  return queued;
}

/**
 * The queue with the popup up at `fromTick` held until `toTick`: its end, and every later popup's start and end, moved
 * on by the ticks between, its start and key kept, so the component keeps its element and the animation's place.
 */
function heldQueue(queue: readonly UpgradePopup[], fromTick: number, toTick: number): readonly UpgradePopup[] {
  const heldTicks = toTick - fromTick;
  const upPopup = queue[0];
  if (heldTicks <= 0 || upPopup === undefined || upPopup.startTick > fromTick) return queue;
  return queue.map((popup, index) => ({
    ...popup,
    startTick: index === 0 ? popup.startTick : popup.startTick + heldTicks,
    endTick: popup.endTick + heldTicks,
  }));
}

/** The trait popups this sample fires against the last one of the same seat; none on its first. */
function firedTraitPopups(
  previous: UpgradePopupMemory,
  sample: UpgradePopupSample,
  ownProgress: OwnProgressView,
): UpgradePopupContent[] {
  if (previous.ownedTraits === null || sample.traits === null) return [];
  const { ownedTraits: before } = previous;
  const traits = sample.traits;
  return gainedTraits(before, ownProgress.ownedTraits).map((gained) =>
    upgradePopupFor(
      gained,
      before.some((trait) => trait.traitId === gained.traitId),
      traits,
    ),
  );
}

/** One snapshot folded into the memory: the popups it fires join the queue, and the ones over by now leave it. */
export function upgradePopupStepFor(previous: UpgradePopupMemory, sample: UpgradePopupSample): UpgradePopupMemory {
  // Another seat, or the clock went back (a new room under the same key), starts over.
  const isSameSeat = previous.seatKey === sample.seatKey && (previous.tick === null || sample.tick >= previous.tick);
  const carried = isSameSeat ? previous : { ...INITIAL_UPGRADE_POPUP_MEMORY, seatKey: sample.seatKey };
  const ownProgress = sample.ownProgress;
  // A giant swallowed is an event, not a change: only one after the last folded tick fires, so a recomputation
  // cannot. The first sample of a seat only remembers, as for the traits: a swallow from before it is not this visit's.
  const giants =
    carried.tick === null ? [] : giantPopupsIn(sample.giantSwallows, sample.seatKey, carried.tick, sample.tick);
  const fired = [...giants, ...(ownProgress === null ? [] : firedTraitPopups(carried, sample, ownProgress))];
  const carriedQueue =
    sample.isUpPopupHeld && carried.tick !== null ? heldQueue(carried.queue, carried.tick, sample.tick) : carried.queue;
  const queue = enqueue(carriedQueue, fired, sample.tick).filter((popup) => popup.endTick > sample.tick);
  return {
    seatKey: sample.seatKey,
    tick: sample.tick,
    ownedTraits: ownProgress?.ownedTraits ?? carried.ownedTraits,
    queue,
  };
}

/** The popup up at `tick`: the queue's head once its start has come. */
export function upgradePopupUpAt(memory: UpgradePopupMemory, tick: number): UpgradePopup | null {
  const head = memory.queue[0];
  return head !== undefined && head.startTick <= tick && tick < head.endTick ? head : null;
}
