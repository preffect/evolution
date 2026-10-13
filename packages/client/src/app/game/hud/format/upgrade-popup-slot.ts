// Where the upgrade, form and giant popups hang (docs/ui/overlays.md §3.8, ticket #840). Alive, the host (the popup
// and a form popup's glow) keeps `CUE_GAP_PX` off the own cell's cues and never comes nearer the centre than the
// picker band's mirror: above the cell, over the room a full rate-tag column takes at the cell's on-screen size, where
// the whole host fits under the top edge; else below it, under the zone pill, unless the picker's band is there; else
// above, pinned to the top edge. The column is reserved whole, so a tag that comes up mid-popup never meets it and the
// popup never jumps. Pure: `upgrade-popup.component.ts` feeds it the viewport, the own cell's radius, the host's
// measured height and whether the picker is open, and binds what it answers as `data-placement` and `--popup-offset`.

import { PLAYER_LIFE_STATE, type PlayerLifeState, type ValueOf } from '@evolution/shared';
import type { ViewportPx } from '../../render/camera';
import { CUE_GAP_PX, RATE_TAG_ROWS_MAX } from '../../render/constants';
import { HALF } from '../../render/geometry';
import { rateTagColumnTopPx, zonePillBottomPx } from '../../render/effects/cue-layout';
import { onScreenRadiusPx, pickerBandOffsetPx } from './picker-band';

/**
 * Above the own cell while it is alive, clear of its cues; below it when there is no room above; under the death
 * overlay's text while dead or spectating, when the cell's cues are gone and the text must stay readable.
 */
export const UPGRADE_POPUP_PLACEMENT = {
  aboveCell: 'above-cell',
  belowCell: 'below-cell',
  belowDeathText: 'below-death-text',
} as const;
export type UpgradePopupPlacement = ValueOf<typeof UPGRADE_POPUP_PLACEMENT>;

/** What the slot is chosen from. */
export interface UpgradePopupRoom {
  readonly lifeState: PlayerLifeState | null;
  readonly viewport: ViewportPx;
  /** The own cell's radius, wu; `null` before the snapshot carries it. */
  readonly ownCellRadiusWu: number | null;
  /** The popup host's height in real px: the popup and, on a form popup, its glow's margin on both sides. */
  readonly popupHeightPx: number;
  /** The trait picker's band is up below the cell (overlays.md §3.2). */
  readonly isPickerOpen: boolean;
}

export interface UpgradePopupSlot {
  readonly placement: UpgradePopupPlacement;
  /**
   * Real px from the viewport centre to the host's edge nearest the cell: its bottom edge above the centre, or its
   * top edge below it. Unused under the death text, which places the host from the top.
   */
  readonly offsetPx: number;
}

const UNUSED_OFFSET_PX = 0;

function fitsOnScreen(offsetPx: number, room: UpgradePopupRoom): boolean {
  return offsetPx + room.popupHeightPx <= room.viewport.height * HALF;
}

/** Above: past the band's mirror and `CUE_GAP_PX` over a full rate-tag column; below: under the zone pill. */
function cueClearancesPx(room: UpgradePopupRoom): { readonly abovePx: number; readonly belowPx: number } {
  const bandPx = pickerBandOffsetPx(room.viewport);
  if (room.ownCellRadiusWu === null) return { abovePx: bandPx, belowPx: bandPx };
  const rPx = onScreenRadiusPx(room.ownCellRadiusWu, room.viewport);
  return {
    abovePx: Math.max(bandPx, rateTagColumnTopPx(rPx, RATE_TAG_ROWS_MAX) + CUE_GAP_PX),
    belowPx: Math.max(bandPx, zonePillBottomPx(rPx) + CUE_GAP_PX),
  };
}

export function upgradePopupSlotFor(room: UpgradePopupRoom): UpgradePopupSlot {
  if (room.lifeState === PLAYER_LIFE_STATE.spectating) {
    return { placement: UPGRADE_POPUP_PLACEMENT.belowDeathText, offsetPx: UNUSED_OFFSET_PX };
  }
  const { abovePx, belowPx } = cueClearancesPx(room);
  if (fitsOnScreen(abovePx, room)) return { placement: UPGRADE_POPUP_PLACEMENT.aboveCell, offsetPx: abovePx };
  if (!room.isPickerOpen && fitsOnScreen(belowPx, room)) {
    return { placement: UPGRADE_POPUP_PLACEMENT.belowCell, offsetPx: belowPx };
  }
  // No room clear of the cues: as high as the top edge allows, never nearer the centre than the band's mirror.
  const pinnedPx = Math.max(pickerBandOffsetPx(room.viewport), room.viewport.height * HALF - room.popupHeightPx);
  return { placement: UPGRADE_POPUP_PLACEMENT.aboveCell, offsetPx: Math.min(abovePx, pinnedPx) };
}
