// Where the trait picker's band and its dim's clear disc sit (docs/ui/overlays.md §3.2), in real px from the
// viewport centre. Under Z1 (decision #324) the own cell grows on screen, so the band hangs from whichever reaches
// lower: the scaled exclusion box plus its gap, or the ladder orbit of the biggest cell this viewport can show
// (the own cell at `CELL_MAX_MASS`) plus a clearance. The dim's disc follows the same cap orbit, so it never greys
// a big cell's orbit. Pure: `hud.component.ts` publishes both as custom properties from its observed box.

import { DEFAULT_BALANCE, radiusForMass } from '@evolution/shared';
import { viewHalfHeightFor, zoomFor, type ViewportPx } from '../../render/camera';
import { ladderOrbitExtentPx } from '../../render/effects/own-cell-geometry';
import { HUD_PLAYER_EXCLUSION_PX, PICKER_BAND_GAP_PX, PICKER_BAND_ORBIT_CLEARANCE_PX } from '../hud-constants';
import { uiScaleFor } from '../../../ui-kit/format/ui-scale';

/** The shipped balance's cap: a room patched with `debug_set_balance` moves its true cap orbit, not this band. */
const CAP_RADIUS_WU = radiusForMass(DEFAULT_BALANCE.growth.CELL_MAX_MASS, DEFAULT_BALANCE.growth);

/** ui/hud.md §3.1.3's orbit extent (backing edge) for the own cell at `CELL_MAX_MASS`, under the Z1 camera, on this viewport. */
export function capOrbitExtentPx(viewport: ViewportPx): number {
  const zoom = zoomFor({ x: 0, y: 0, viewHalfHeightWu: viewHalfHeightFor(CAP_RADIUS_WU) }, viewport);
  return ladderOrbitExtentPx(CAP_RADIUS_WU * zoom);
}

/** The picker's title row top, below the viewport centre: `max((box + gap) × scale, cap orbit extent + clearance)`. */
export function pickerBandOffsetPx(viewport: ViewportPx): number {
  const boxPx = (HUD_PLAYER_EXCLUSION_PX + PICKER_BAND_GAP_PX) * uiScaleFor(viewport.width, viewport.height);
  return Math.max(boxPx, capOrbitExtentPx(viewport) + PICKER_BAND_ORBIT_CLEARANCE_PX);
}

/** The radius of the dim's clear disc around the centre: `max(box × scale, cap orbit extent)`. */
export function pickerSpotlightRadiusPx(viewport: ViewportPx): number {
  const boxPx = HUD_PLAYER_EXCLUSION_PX * uiScaleFor(viewport.width, viewport.height);
  return Math.max(boxPx, capOrbitExtentPx(viewport));
}
