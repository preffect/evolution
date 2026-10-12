// The upgrade popups' every decision (docs/ui/overlays.md §3.8, #783), as one pure step over snapshots: which trait
// gained or tier up fires which popup, what it says, and when it is up. A trait the own cell did not hold, or holds at
// a higher tier than the last snapshot said, fires an upgrade popup; a form (the rung-5 gates, `form-facts.ts`) gained
// fires the larger form popup with its real-life line instead. The text is a picker card's (`traitCardViewFor`):
// the catalog's name, the tier numeral and the tier row's effect lines with their tones, so no number is typed. A giant
// the own cell swallowed fires the giant popup, as large as a form's (`giant-popups.ts`): an event of the snapshot's
// effects rather than a change between two snapshots, so it fires once per new tick, never on a recomputation.
//
// Popups queue rather than stack: one is up at a time, each for its kind's duration in room ticks, and a popup fired
// while another is up or waiting starts when the last one ends. Every trigger is a change between two snapshots of the
// same seat, like the toasts' (§3.6): the first snapshot of a seat only remembers, so a late joiner's traits and a
// reconnect fire nothing, and a rematch, which empties the traits, gains nothing. `UpgradePopupService` carries the
// memory; `upgrade-popup.component.ts` binds the popup that is up.

import {
  CELL_STAGE,
  PLAYER_LIFE_STATE,
  secondsToTicks,
  type EntityId,
  type GameEffect,
  type PlayerLifeState,
  type OwnProgressView,
  type OwnedTrait,
  type ValueOf,
} from '@evolution/shared';
import { FORM_POPUP_DURATION_SECONDS, UPGRADE_POPUP_DURATION_SECONDS } from '../upgrade-popup-constants';
import { formRealLifeLine, isFormTrait } from './form-facts';
import { giantPopupsIn } from './giant-popups';
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

/**
 * Where the popups hang (docs/ui/overlays.md §3.8): above the own cell while it is alive, clear of the exclusion box;
 * under the death overlay's text while dead or spectating, when the box does not apply and the text must stay readable.
 */
export const UPGRADE_POPUP_PLACEMENT = { aboveCell: 'above-cell', belowDeathText: 'below-death-text' } as const;
export type UpgradePopupPlacement = ValueOf<typeof UPGRADE_POPUP_PLACEMENT>;

export function upgradePopupPlacementFor(lifeState: PlayerLifeState | null): UpgradePopupPlacement {
  return lifeState === PLAYER_LIFE_STATE.spectating
    ? UPGRADE_POPUP_PLACEMENT.belowDeathText
    : UPGRADE_POPUP_PLACEMENT.aboveCell;
}

/** One snapshot as the popups read it. */
export interface UpgradePopupSample {
  /** The room and seat the snapshot belongs to; a change starts the memory over. */
  readonly seatKey: string;
  readonly tick: number;
  /** `null` before the room names us: nothing is remembered until it does. */
  readonly ownProgress: OwnProgressView | null;
  /** The live balance's tier tables; `null` before the room sends it, when a sample only remembers. */
  readonly traits: TraitModifierTables | null;
  /** The own cell's id, `null` while it has none: the giant popup fires only for a giant this cell swallowed. */
  readonly ownCellId: EntityId | null;
  /** This broadcast window's effects, where a giant swallowed shows as a `cell_absorbed`. */
  readonly effects: readonly GameEffect[];
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
  // A giant swallowed is an event, not a change: only a tick not yet seen may fire it, so a recomputation cannot.
  const isNewTick = carried.tick === null || sample.tick > carried.tick;
  const giants = isNewTick && sample.ownCellId !== null ? giantPopupsIn(sample.effects, sample.ownCellId) : [];
  const fired = [...giants, ...(ownProgress === null ? [] : firedTraitPopups(carried, sample, ownProgress))];
  const queue = enqueue(carried.queue, fired, sample.tick).filter((popup) => popup.endTick > sample.tick);
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
