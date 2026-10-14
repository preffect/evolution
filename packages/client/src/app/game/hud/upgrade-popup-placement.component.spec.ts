// Where the upgrade popup's host hangs (docs/ui/overlays.md §3.8): the slot `upgradePopupSlotFor` answers for the HUD's
// box, the own cell and the host's measured height (ticket #840), under the death text while dead, and the fade across
// when that slot changes while a popup is up (ticket #861).

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  PLAYER_LIFE_STATE,
  createTestPlayerProgressView,
  createTestSnapshot,
  createTestTraitOfferView,
  entityId,
  radiusForMass,
  type OwnedTrait,
} from '@evolution/shared';
import { createTestCellView } from '../../../testing/builders';
import {
  PARAMECIUM,
  POPUP_OWN_PLAYER_ID,
  POPUP_START_TICK,
  UpgradePopupHarness,
} from '../../../testing/upgrade-popup-harness';
import { HUD_TEST_ID } from '../test-ids/hud-test-ids';
import { UPGRADE_POPUP_PLACEMENT, upgradePopupSlotFor, type UpgradePopupRoom } from './format/upgrade-popup-slot';
import { FORM_POPUP_IN_MS, UPGRADE_POPUP_MOVE_HOLD_MS } from './upgrade-popup-constants';

const OWN_CELL_ID = entityId('c-own');
/** Ticket #840's frame: a mass-1250 own cell at 1024 × 640 under a form-sized popup, as the host measures it. */
const SMALL_VIEWPORT = { width: 1024, height: 640 };
const BIG_CELL_RADIUS_WU = radiusForMass(1250, DEFAULT_BALANCE.growth);
const FORM_HOST_HEIGHT_PX = 176;
/** A viewport with room above the cell for any popup while the own cell is not known. */
const ROOMY_VIEWPORT = { width: 1280, height: 800 };

describe('UpgradePopupComponent placement (docs/ui/overlays.md §3.8)', () => {
  let harness: UpgradePopupHarness;

  function placement(): string | null {
    return harness.host().getAttribute('data-placement');
  }

  function isMoving(): boolean {
    return harness.host().classList.contains('moving');
  }

  /** The big own cell in the small viewport, holding `ownedTraits`, with the picker open or not. */
  function deliverOverBigCell(tick: number, ownedTraits: OwnedTrait[], isPickerOpen: boolean): void {
    const ownProgress = createTestPlayerProgressView({
      playerId: POPUP_OWN_PLAYER_ID,
      stage: CELL_STAGE.eukaryote,
      ownedTraits,
      offer: isPickerOpen ? createTestTraitOfferView() : null,
    });
    const cells = [createTestCellView({ id: OWN_CELL_ID, playerId: POPUP_OWN_PLAYER_ID, radius: BIG_CELL_RADIUS_WU })];
    harness.deliver(createTestSnapshot({ tick, ownProgress, cells }));
    harness.fixture.detectChanges();
  }

  /** A fresh host that lays out `FORM_HOST_HEIGHT_PX` tall in the small viewport, over the big own cell. */
  function placedOverBigCell(isPickerOpen: boolean): UpgradePopupRoom {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, SMALL_VIEWPORT.width, FORM_HOST_HEIGHT_PX),
    );
    harness.recreate();
    harness.fixture.componentRef.setInput('viewport', SMALL_VIEWPORT);
    deliverOverBigCell(POPUP_START_TICK + 1, [], isPickerOpen);
    vi.restoreAllMocks();
    return {
      lifeState: PLAYER_LIFE_STATE.alive,
      viewport: SMALL_VIEWPORT,
      ownCellRadiusWu: BIG_CELL_RADIUS_WU,
      popupHeightPx: FORM_HOST_HEIGHT_PX,
      isPickerOpen,
    };
  }

  beforeEach(() => {
    harness = new UpgradePopupHarness();
  });

  it('hangs under the death text while the player is dead, and back above the cell once alive', () => {
    harness.fixture.componentRef.setInput('viewport', ROOMY_VIEWPORT);
    harness.fixture.detectChanges();
    expect(placement()).toBe(UPGRADE_POPUP_PLACEMENT.aboveCell);
    // A pick made while spectating (overlays.md §3.3): the offer stays pickable while dead.
    harness.receive(POPUP_START_TICK + 1, [PARAMECIUM], PLAYER_LIFE_STATE.spectating);
    expect(harness.popup(HUD_TEST_ID.formPopup)).not.toBeNull();
    expect(placement()).toBe(UPGRADE_POPUP_PLACEMENT.belowDeathText);
    harness.receive(POPUP_START_TICK + 2, [PARAMECIUM]);
    expect(placement()).toBe(UPGRADE_POPUP_PLACEMENT.aboveCell);
  });

  it('drops below the cell when the HUD’s box, the cell and the host’s height leave no room above its cues', () => {
    const slot = upgradePopupSlotFor(placedOverBigCell(false));
    expect(slot.placement).toBe(UPGRADE_POPUP_PLACEMENT.belowCell);
    expect(placement()).toBe(UPGRADE_POPUP_PLACEMENT.belowCell);
    expect(harness.host().style.getPropertyValue('--popup-offset')).toBe(`${slot.offsetPx}px`);
  });

  it('pins above while the picker’s band is below the cell', () => {
    const slot = upgradePopupSlotFor(placedOverBigCell(true));
    expect(placement()).toBe(UPGRADE_POPUP_PLACEMENT.pinned);
    expect(harness.host().style.getPropertyValue('--popup-offset')).toBe(`${slot.offsetPx}px`);
  });

  it('fades out below the cell, then in at the pinned slot, when the picker opens in its life (ticket #861)', () => {
    const room = placedOverBigCell(false);
    const below = upgradePopupSlotFor(room);
    const pinned = upgradePopupSlotFor({ ...room, isPickerOpen: true });
    deliverOverBigCell(POPUP_START_TICK + 2, [PARAMECIUM], false);
    expect(harness.popup(HUD_TEST_ID.formPopup)).not.toBeNull();
    harness.scheduler.advanceMilliseconds(FORM_POPUP_IN_MS);

    deliverOverBigCell(POPUP_START_TICK + 3, [PARAMECIUM], true);
    expect(placement()).toBe(UPGRADE_POPUP_PLACEMENT.belowCell);
    expect(harness.host().style.getPropertyValue('--popup-offset')).toBe(`${below.offsetPx}px`);
    expect(isMoving()).toBe(true);

    harness.scheduler.advanceMilliseconds(UPGRADE_POPUP_MOVE_HOLD_MS);
    harness.fixture.detectChanges();
    expect(placement()).toBe(UPGRADE_POPUP_PLACEMENT.pinned);
    expect(harness.host().style.getPropertyValue('--popup-offset')).toBe(`${pinned.offsetPx}px`);
    expect(isMoving()).toBe(false);
    expect(harness.popup(HUD_TEST_ID.formPopup)).not.toBeNull();
  });

  it('takes a new slot at once while it is still entering', () => {
    placedOverBigCell(false);
    deliverOverBigCell(POPUP_START_TICK + 2, [PARAMECIUM], false);
    expect(placement()).toBe(UPGRADE_POPUP_PLACEMENT.belowCell);
    harness.scheduler.advanceMilliseconds(FORM_POPUP_IN_MS - 1);

    deliverOverBigCell(POPUP_START_TICK + 3, [PARAMECIUM], true);
    expect(harness.popup(HUD_TEST_ID.formPopup)).not.toBeNull();
    expect(placement()).toBe(UPGRADE_POPUP_PLACEMENT.pinned);
    expect(isMoving()).toBe(false);
  });
});
