// @vitest-environment node
// Where the popups hang (docs/ui/overlays.md §3.8, ticket #840): the host, popup and glow together, never meets the own
// cell's cues — the mass chip with a full rate-tag column over it, and the zone pill under the orbit — on any
// supported viewport at any cell size, never comes nearer the centre than the picker band does, and stays on screen.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, PLAYER_LIFE_STATE, radiusForMass } from '@evolution/shared';
import { CUE_GAP_PX, RATE_TAG_ROWS_MAX } from '../../render/constants';
import { rateTagColumnTopPx, zonePillBottomPx } from '../../render/effects/cue-layout';
import { HALF } from '../../render/geometry';
import { uiScaleFor } from '../../../ui-kit/format/ui-scale';
import { FORM_POPUP_GLOW_PX } from '../upgrade-popup-constants';
import { onScreenRadiusPx, pickerBandOffsetPx } from './picker-band';
import {
  UPGRADE_POPUP_PLACEMENT,
  upgradePopupSlotFor,
  type UpgradePopupRoom,
  type UpgradePopupSlot,
} from './upgrade-popup-slot';

const VIEWPORTS = [
  { width: 1024, height: 640 },
  { width: 1280, height: 800 },
  { width: 1280, height: 1000 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
];

const { CELL_STARTING_MASS, CELL_MAX_MASS } = DEFAULT_BALANCE.growth;
const MASSES = [CELL_STARTING_MASS, 100, 300, 600, 1000, 1250, 2000, 3000, CELL_MAX_MASS];

/**
 * The popups at scale 1: the tallest form popup, Amoeba Pseudopods' (its four effect lines on two rows, measured on PR
 * #789), whose host adds its glow's margin on both sides; and an upgrade popup as tall as one fits above a full column
 * at the cap at 1024 × 640 (overlays.md §3.8).
 */
const TALLEST_FORM_POPUP_PX = 174;
const TALL_UPGRADE_POPUP_PX = 123;

function formHostPx(width: number, height: number): number {
  return (TALLEST_FORM_POPUP_PX + 2 * FORM_POPUP_GLOW_PX) * uiScaleFor(width, height);
}

function upgradeHostPx(width: number, height: number): number {
  return TALL_UPGRADE_POPUP_PX * uiScaleFor(width, height);
}

const HOSTS = [
  { kind: 'form', hostPx: formHostPx },
  { kind: 'upgrade', hostPx: upgradeHostPx },
];

function radiusAt(mass: number): number {
  return radiusForMass(mass, DEFAULT_BALANCE.growth);
}

function roomAt(width: number, height: number, mass: number, popupHeightPx: number): UpgradePopupRoom {
  return {
    lifeState: PLAYER_LIFE_STATE.alive,
    viewport: { width, height },
    ownCellRadiusWu: radiusAt(mass),
    popupHeightPx,
    isPickerOpen: false,
  };
}

/** The host's edge nearest the cell clears that side's cues by `CUE_GAP_PX`, and its far edge stays on screen. */
function expectClearOfCues(slot: UpgradePopupSlot, room: UpgradePopupRoom): void {
  const rPx = onScreenRadiusPx(room.ownCellRadiusWu!, room.viewport);
  const cuesPx =
    slot.placement === UPGRADE_POPUP_PLACEMENT.aboveCell
      ? rateTagColumnTopPx(rPx, RATE_TAG_ROWS_MAX)
      : zonePillBottomPx(rPx);
  expect([UPGRADE_POPUP_PLACEMENT.aboveCell, UPGRADE_POPUP_PLACEMENT.belowCell]).toContain(slot.placement);
  expect(slot.offsetPx).toBeGreaterThanOrEqual(cuesPx + CUE_GAP_PX);
  expect(slot.offsetPx).toBeGreaterThanOrEqual(pickerBandOffsetPx(room.viewport));
  expect(slot.offsetPx + room.popupHeightPx).toBeLessThanOrEqual(room.viewport.height * HALF);
}

describe('upgradePopupSlotFor (docs/ui/overlays.md §3.8)', () => {
  it('keeps the form popup’s glow off the DECAY tag at 1024 × 640 with a mass-1250 cell (ticket #840)', () => {
    // The reported frame: the mass chip and one rate tag over a mass-1250 cell, a form-sized popup over them.
    const room = roomAt(1024, 640, 1250, formHostPx(1024, 640));
    const slot = upgradePopupSlotFor(room);
    const rPx = onScreenRadiusPx(room.ownCellRadiusWu!, room.viewport);
    const decayTagTopPx = rateTagColumnTopPx(rPx, 1);
    const isAbove = slot.placement === UPGRADE_POPUP_PLACEMENT.aboveCell;
    expect(isAbove ? slot.offsetPx >= decayTagTopPx + CUE_GAP_PX : slot.offsetPx > 0).toBe(true);
    expectClearOfCues(slot, room);
  });

  describe.each(VIEWPORTS)('at $width × $height', ({ width, height }) => {
    it.each(HOSTS.flatMap((host) => MASSES.map((mass) => ({ ...host, mass }))))(
      'keeps a $kind popup clear of a mass-$mass cell’s cues and on screen',
      ({ hostPx, mass }) => {
        const room = roomAt(width, height, mass, hostPx(width, height));
        expectClearOfCues(upgradePopupSlotFor(room), room);
      },
    );
  });

  it('hangs above the cell wherever it fits there', () => {
    const smallCell = roomAt(1920, 1080, CELL_STARTING_MASS, formHostPx(1920, 1080));
    expect(upgradePopupSlotFor(smallCell).placement).toBe(UPGRADE_POPUP_PLACEMENT.aboveCell);
    const upgradeAtCap = roomAt(1024, 640, CELL_MAX_MASS, upgradeHostPx(1024, 640));
    expect(upgradePopupSlotFor(upgradeAtCap).placement).toBe(UPGRADE_POPUP_PLACEMENT.aboveCell);
  });

  it('drops below the cell, under the zone pill, when a full rate-tag column leaves no room above', () => {
    const room = roomAt(1024, 640, 1250, formHostPx(1024, 640));
    const slot = upgradePopupSlotFor(room);
    expect(slot.placement).toBe(UPGRADE_POPUP_PLACEMENT.belowCell);
    const rPx = onScreenRadiusPx(room.ownCellRadiusWu!, room.viewport);
    expect(slot.offsetPx).toBe(Math.max(pickerBandOffsetPx(room.viewport), zonePillBottomPx(rPx) + CUE_GAP_PX));
  });

  it('never drops below while the picker’s band is there: it pins to the top edge instead', () => {
    const room = { ...roomAt(1024, 640, 1250, formHostPx(1024, 640)), isPickerOpen: true };
    const slot = upgradePopupSlotFor(room);
    expect(slot.placement).toBe(UPGRADE_POPUP_PLACEMENT.aboveCell);
    expect(slot.offsetPx).toBeCloseTo(room.viewport.height * HALF - room.popupHeightPx);
    expect(slot.offsetPx).toBeGreaterThanOrEqual(pickerBandOffsetPx(room.viewport));
  });

  it('keeps the picker band’s mirror before the own cell is known', () => {
    const room = { ...roomAt(1280, 800, CELL_STARTING_MASS, upgradeHostPx(1280, 800)), ownCellRadiusWu: null };
    expect(upgradePopupSlotFor(room)).toEqual({
      placement: UPGRADE_POPUP_PLACEMENT.aboveCell,
      offsetPx: pickerBandOffsetPx(room.viewport),
    });
  });

  it('hangs under the death text while the player is dead or spectating', () => {
    const room = {
      ...roomAt(1280, 800, CELL_MAX_MASS, formHostPx(1280, 800)),
      lifeState: PLAYER_LIFE_STATE.spectating,
    };
    expect(upgradePopupSlotFor(room).placement).toBe(UPGRADE_POPUP_PLACEMENT.belowDeathText);
  });
});
