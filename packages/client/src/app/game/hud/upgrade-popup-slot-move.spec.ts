// @vitest-environment node
// A popup's move to another slot while it is up (docs/ui/overlays.md §3.8, ticket #861): held where it was while it
// fades out, then at the newest slot; followed at once within a placement, during its entrance, between popups, and
// out of the held slot, where nothing is shown (ticket #863).

import { beforeEach, describe, expect, it } from 'vitest';
import { ManualScheduler } from '@evolution/shared';
import { UPGRADE_POPUP_KIND, type UpgradePopup, type UpgradePopupKind } from './format/upgrade-popup-kinds';
import { UPGRADE_POPUP_PLACEMENT, type UpgradePopupSlot } from './format/upgrade-popup-slot';
import { FORM_POPUP_IN_MS, UPGRADE_POPUP_IN_MS, UPGRADE_POPUP_MOVE_HOLD_MS } from './upgrade-popup-constants';
import { UpgradePopupSlotMove } from './upgrade-popup-slot-move';

const BELOW: UpgradePopupSlot = { placement: UPGRADE_POPUP_PLACEMENT.belowCell, offsetPx: 140 };
const BELOW_EASED: UpgradePopupSlot = { placement: UPGRADE_POPUP_PLACEMENT.belowCell, offsetPx: 146 };
const PINNED: UpgradePopupSlot = { placement: UPGRADE_POPUP_PLACEMENT.pinned, offsetPx: 102 };
const PINNED_EASED: UpgradePopupSlot = { placement: UPGRADE_POPUP_PLACEMENT.pinned, offsetPx: 98 };
const ABOVE: UpgradePopupSlot = { placement: UPGRADE_POPUP_PLACEMENT.aboveCell, offsetPx: 90 };
const HELD: UpgradePopupSlot = { placement: UPGRADE_POPUP_PLACEMENT.held, offsetPx: 0 };

function popupOf(key: string, kind: UpgradePopupKind = UPGRADE_POPUP_KIND.form): UpgradePopup {
  return {
    kind,
    kicker: null,
    traitId: null,
    giantSpecies: null,
    key,
    title: key,
    effects: [],
    effectTones: [],
    realLifeLine: null,
    startTick: 0,
    endTick: 1,
  };
}

describe('UpgradePopupSlotMove (docs/ui/overlays.md §3.8, ticket #861)', () => {
  let scheduler: ManualScheduler;
  let move: UpgradePopupSlotMove;

  /** A form popup up below the cell, its entrance over. */
  function settledBelow(popup: UpgradePopup): void {
    move.follow(popup, BELOW);
    scheduler.advanceMilliseconds(FORM_POPUP_IN_MS);
  }

  beforeEach(() => {
    scheduler = new ManualScheduler();
    move = new UpgradePopupSlotMove(scheduler);
  });

  it('holds a popup where it was while it fades out, then shows it at the newest slot', () => {
    const popup = popupOf('form-1');
    settledBelow(popup);

    move.follow(popup, PINNED);
    expect(move.isFadingOut()).toBe(true);
    expect(move.slotToShow(PINNED)).toBe(BELOW);
    move.follow(popup, PINNED_EASED);
    scheduler.advanceMilliseconds(UPGRADE_POPUP_MOVE_HOLD_MS - 1);
    expect(move.slotToShow(PINNED_EASED)).toBe(BELOW);

    scheduler.advanceMilliseconds(1);
    expect(move.isFadingOut()).toBe(false);
    expect(move.slotToShow(PINNED_EASED)).toBe(PINNED_EASED);
  });

  it('ends a hold when it began, whatever slots are answered during it, and leaves no timer to cut the next one', () => {
    const popup = popupOf('form-1');
    const partWayMs = Math.floor(UPGRADE_POPUP_MOVE_HOLD_MS / 2);
    settledBelow(popup);
    move.follow(popup, PINNED);
    scheduler.advanceMilliseconds(partWayMs);
    move.follow(popup, ABOVE);
    scheduler.advanceMilliseconds(UPGRADE_POPUP_MOVE_HOLD_MS - partWayMs - 1);
    expect(move.slotToShow(ABOVE)).toBe(BELOW);
    scheduler.advanceMilliseconds(1);
    expect(move.slotToShow(ABOVE)).toBe(ABOVE);

    move.follow(popup, BELOW);
    scheduler.advanceMilliseconds(UPGRADE_POPUP_MOVE_HOLD_MS - 1);
    expect(move.isFadingOut()).toBe(true);
    expect(move.slotToShow(BELOW)).toBe(ABOVE);
    scheduler.advanceMilliseconds(1);
    expect(move.slotToShow(BELOW)).toBe(BELOW);
  });

  it('fades out of its slot into the held one when the picker opens, and takes its slot at once when it closes', () => {
    const popup = popupOf('form-1');
    settledBelow(popup);
    move.follow(popup, HELD);
    expect(move.isFadingOut()).toBe(true);
    expect(move.slotToShow(HELD)).toBe(BELOW);
    scheduler.advanceMilliseconds(UPGRADE_POPUP_MOVE_HOLD_MS);
    expect(move.slotToShow(HELD)).toBe(HELD);

    move.follow(popup, BELOW_EASED);
    expect(move.isFadingOut()).toBe(false);
    expect(move.slotToShow(BELOW_EASED)).toBe(BELOW_EASED);
  });

  it('moves back the same way when the slot changes again between two shown slots', () => {
    const popup = popupOf('form-1');
    settledBelow(popup);
    move.follow(popup, PINNED);
    scheduler.advanceMilliseconds(UPGRADE_POPUP_MOVE_HOLD_MS);

    move.follow(popup, BELOW);
    expect(move.slotToShow(BELOW)).toBe(PINNED);
    scheduler.advanceMilliseconds(UPGRADE_POPUP_MOVE_HOLD_MS);
    expect(move.slotToShow(BELOW)).toBe(BELOW);
  });

  it('follows its slot at once while the placement stays the same', () => {
    const popup = popupOf('form-1');
    settledBelow(popup);
    move.follow(popup, BELOW_EASED);
    expect(move.isFadingOut()).toBe(false);
    expect(move.slotToShow(BELOW_EASED)).toBe(BELOW_EASED);
  });

  it.each([
    { kind: UPGRADE_POPUP_KIND.upgrade, entranceMs: UPGRADE_POPUP_IN_MS },
    { kind: UPGRADE_POPUP_KIND.form, entranceMs: FORM_POPUP_IN_MS },
    { kind: UPGRADE_POPUP_KIND.giant, entranceMs: FORM_POPUP_IN_MS },
  ])('takes a new slot at once during a $kind popup’s entrance, and fades after it', ({ kind, entranceMs }) => {
    const popup = popupOf('popup-1', kind);
    move.follow(popup, ABOVE);
    scheduler.advanceMilliseconds(entranceMs - 1);
    move.follow(popup, BELOW);
    expect(move.isFadingOut()).toBe(false);
    expect(move.slotToShow(BELOW)).toBe(BELOW);

    scheduler.advanceMilliseconds(1);
    move.follow(popup, PINNED);
    expect(move.isFadingOut()).toBe(true);
  });

  it('starts the next popup in its own slot, dropping the last one’s move', () => {
    settledBelow(popupOf('form-1'));
    move.follow(popupOf('form-1'), PINNED);
    expect(move.isFadingOut()).toBe(true);

    move.follow(popupOf('form-2'), ABOVE);
    expect(move.isFadingOut()).toBe(false);
    expect(move.slotToShow(ABOVE)).toBe(ABOVE);
    scheduler.advanceMilliseconds(UPGRADE_POPUP_MOVE_HOLD_MS);
    expect(move.slotToShow(ABOVE)).toBe(ABOVE);
  });

  it('never holds an empty host: with no popup up, the slot is followed at once', () => {
    settledBelow(popupOf('form-1'));
    move.follow(null, PINNED);
    expect(move.isFadingOut()).toBe(false);
    move.follow(null, BELOW);
    expect(move.slotToShow(BELOW)).toBe(BELOW);
  });

  it('cancels a pending fade when stopped', () => {
    const popup = popupOf('form-1');
    settledBelow(popup);
    move.follow(popup, PINNED);
    move.stop();
    scheduler.advanceMilliseconds(UPGRADE_POPUP_MOVE_HOLD_MS);
    expect(move.slotToShow(PINNED)).toBe(BELOW);
  });
});
