// The picker band's anchor (docs/ui/overlays.md §3.2, docs/ui/hud.md §3.1.3's picker-band inequality): the band
// clears the exclusion box and the own cell's orbit at the cap on every viewport, by construction, and the side that
// wins is the one the docs name at 1024 × 640, 1280 × 800, 1280 × 1000, 1920 × 1080 and 2560 × 1440.

import { describe, expect, it } from 'vitest';
import { HUD_PLAYER_EXCLUSION_PX, PICKER_BAND_GAP_PX, PICKER_BAND_ORBIT_CLEARANCE_PX } from '../hud-constants';
import { uiScaleFor } from '../../../ui-kit/format/ui-scale';
import { capOrbitExtentPx, pickerBandOffsetPx, pickerSpotlightRadiusPx } from './picker-band';

/** Half the last digit overlays.md §3.2 prints its offsets to. */
const PRINTED_TOLERANCE_PX = 0.05;

interface ViewportCase {
  readonly width: number;
  readonly height: number;
  /** The offset overlays.md §3.2 states for this viewport. */
  readonly printedOffsetPx: number;
  /** Which side of the `max` the doc says wins. */
  readonly winner: 'box' | 'orbit';
}

const VIEWPORTS: readonly ViewportCase[] = [
  { width: 1024, height: 640, printedOffsetPx: 109.0, winner: 'orbit' },
  { width: 1280, height: 800, printedOffsetPx: 136, winner: 'box' },
  { width: 1280, height: 1000, printedOffsetPx: 156.8, winner: 'orbit' },
  { width: 1920, height: 1080, printedOffsetPx: 183.6, winner: 'box' },
  { width: 2560, height: 1440, printedOffsetPx: 215.2, winner: 'orbit' },
];

function boxOffsetPx(viewport: ViewportCase): number {
  return (HUD_PLAYER_EXCLUSION_PX + PICKER_BAND_GAP_PX) * uiScaleFor(viewport.width, viewport.height);
}

function orbitOffsetPx(viewport: ViewportCase): number {
  return capOrbitExtentPx(viewport) + PICKER_BAND_ORBIT_CLEARANCE_PX;
}

describe('pickerBandOffsetPx', () => {
  it.each(VIEWPORTS)('clears the scaled box and the cap orbit at $width × $height', (viewport) => {
    const offsetPx = pickerBandOffsetPx(viewport);
    expect(offsetPx).toBeGreaterThanOrEqual(boxOffsetPx(viewport));
    expect(offsetPx).toBeGreaterThanOrEqual(orbitOffsetPx(viewport));
  });

  it.each(VIEWPORTS)('anchors from the $winner at $width × $height, as overlays.md §3.2 says', (viewport) => {
    const winnerPx = viewport.winner === 'box' ? boxOffsetPx(viewport) : orbitOffsetPx(viewport);
    const loserPx = viewport.winner === 'box' ? orbitOffsetPx(viewport) : boxOffsetPx(viewport);
    expect(pickerBandOffsetPx(viewport)).toBe(winnerPx);
    expect(winnerPx).toBeGreaterThan(loserPx);
  });

  it.each(VIEWPORTS)('is $printedOffsetPx px at $width × $height', (viewport) => {
    expect(Math.abs(pickerBandOffsetPx(viewport) - viewport.printedOffsetPx)).toBeLessThanOrEqual(PRINTED_TOLERANCE_PX);
  });

  it('moves nothing on the reference viewport: the box and its gap at scale 1', () => {
    expect(pickerBandOffsetPx({ width: 1280, height: 800 })).toBe(HUD_PLAYER_EXCLUSION_PX + PICKER_BAND_GAP_PX);
  });

  it('answers a finite offset for a box with no layout yet', () => {
    expect(Number.isFinite(pickerBandOffsetPx({ width: 0, height: 0 }))).toBe(true);
  });
});

describe('pickerSpotlightRadiusPx', () => {
  it.each(VIEWPORTS)('never greys the box or the cap orbit at $width × $height', (viewport) => {
    const radiusPx = pickerSpotlightRadiusPx(viewport);
    expect(radiusPx).toBeGreaterThanOrEqual(HUD_PLAYER_EXCLUSION_PX * uiScaleFor(viewport.width, viewport.height));
    expect(radiusPx).toBeGreaterThanOrEqual(capOrbitExtentPx(viewport));
  });

  it('opens past the exclusion box to the cap orbit already on the reference viewport', () => {
    const reference = { width: 1280, height: 800 };
    expect(capOrbitExtentPx(reference)).toBeGreaterThan(HUD_PLAYER_EXCLUSION_PX);
    expect(pickerSpotlightRadiusPx(reference)).toBe(capOrbitExtentPx(reference));
  });

  it('is the scaled exclusion box on a box with no layout yet, where no orbit shows', () => {
    expect(pickerSpotlightRadiusPx({ width: 0, height: 0 })).toBe(HUD_PLAYER_EXCLUSION_PX * uiScaleFor(0, 0));
  });
});
