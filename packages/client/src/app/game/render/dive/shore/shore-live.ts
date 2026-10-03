// What the live sea draws this frame (docs/rendering/opening-dive.md §4, ticket #801): the mockup's moving parts of
// `drawShore` worked out from the zoom and the ambient clock, so the shader only composites. Pure: the caustic sheets on
// the floor, the swell, the ripples and glints, the four breakers and the swash.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { SHORE_SEABED } from '../../constants/dive-shore';
import { SHORE_CAUSTIC_SHEETS, SHORE_RIPPLES, SHORE_SURF, SHORE_SWELL } from '../../constants/dive-shore-live';
import { HALF, smoothstep } from '../../geometry';
import { trueTileWeight } from './shore-paint';

/** A tile laid over the sea: its size, turn and offset in metres, and its strength. */
export interface LiveSheet {
  readonly tileM: number;
  readonly turn: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly alpha: number;
}

/** One breaker: how far out it is, its strength and width in metres, and where its dashes start. */
export interface LiveBreaker {
  readonly distanceM: number;
  readonly alpha: number;
  readonly widthM: number;
  readonly dashOffsetM: number;
}

export interface LiveSwash {
  readonly distanceM: number;
  readonly laceWidthM: number;
  /** The lace's foam tile against its mean colour (`trueStyle`'s weight). */
  readonly laceTileWeight: number;
}

export interface ShoreLiveFrame {
  /** The sea floor through the shallows: its tile, and its strength (its fade times its alpha). */
  readonly floor: LiveSheet;
  readonly caustics: readonly LiveSheet[];
  readonly swell: LiveSheet;
  readonly ripples: readonly LiveSheet[];
  readonly glints: readonly LiveSheet[];
  /** Whether the close surf draws: the far surf is in the snapshot. */
  readonly isSurfOn: boolean;
  readonly breakers: readonly LiveBreaker[];
  /** The farthest out any breaker paints, wander and width included: past it the shader skips them. */
  readonly breakerReachM: number;
  /** The breakers' foam lace tile against its mean colour. */
  readonly laceTileWeight: number;
  readonly swash: LiveSwash;
}

/** What a live frame is worked out from: the view's zoom and scale, and the ambient clock. */
export interface LiveInputs {
  readonly zoom: number;
  readonly pixelsPerMetre: number;
  readonly timeSeconds: number;
}

function causticSheets(inputs: LiveInputs): LiveSheet[] {
  return SHORE_CAUSTIC_SHEETS.map((sheet) => ({
    tileM: sheet.tileM,
    turn: sheet.turn,
    offsetX: inputs.timeSeconds * sheet.driftX,
    offsetY: inputs.timeSeconds * sheet.driftY,
    alpha: sheet.alpha,
  }));
}

function swellSheet(inputs: LiveInputs): LiveSheet {
  const swell = SHORE_SWELL;
  const weight =
    smoothstep(swell.fadeIn.fromZoom, swell.fadeIn.toZoom, inputs.zoom) *
    smoothstep(swell.fadeOut.fromZoom, swell.fadeOut.toZoom, inputs.zoom);
  return {
    tileM: swell.tileM,
    turn: swell.turn,
    offsetX: 0,
    offsetY: (inputs.timeSeconds * swell.driftY) % swell.tileM,
    alpha: swell.alpha * weight,
  };
}

function rippleSheets(inputs: LiveInputs): { ripples: LiveSheet[]; glints: LiveSheet[] } {
  const ripples = SHORE_RIPPLES;
  const weight = smoothstep(ripples.fromPx, ripples.toPx, ripples.tileM * inputs.pixelsPerMetre);
  const drift = inputs.timeSeconds * ripples.drift;
  const twinkle = HALF + HALF * Math.sin(inputs.timeSeconds * ripples.twinkleRate);
  return {
    ripples: ripples.sheets.map((sheet) => ({
      tileM: ripples.tileM * sheet.tileShare,
      turn: sheet.turn,
      offsetX: drift * sheet.driftX,
      offsetY: drift * sheet.driftY,
      alpha: sheet.alpha * weight,
    })),
    glints: ripples.glints.map((sheet, index) => ({
      tileM: sheet.tileM,
      turn: sheet.turn,
      offsetX: drift * sheet.driftX,
      offsetY: drift * sheet.driftY,
      alpha: sheet.alpha * (index === 0 ? twinkle : 1 - twinkle) * weight,
    })),
  };
}

/** The four breakers rolling in, each one a quarter of the period behind the last (`drawSurf`'s `W`). */
export function surfBreakers(inputs: LiveInputs): LiveBreaker[] {
  const surf = SHORE_SURF;
  return Array.from({ length: surf.breakers }, (_unused, index) => {
    const phase = (((inputs.timeSeconds / surf.periodSeconds + index / surf.breakers) % 1) + 1) % 1;
    const widthM = surf.width.base + surf.width.gain * phase * phase;
    const isVisible = widthM * inputs.pixelsPerMetre >= surf.minWidthPx;
    return {
      distanceM: surf.startM + surf.travelM * (1 - phase) ** surf.travelPower,
      alpha: isVisible
        ? Math.sin(phase * Math.PI) ** surf.alpha.power * (surf.alpha.base + surf.alpha.gain * phase)
        : 0,
      widthM,
      dashOffsetM: index * surf.dash.perBreakerM + inputs.timeSeconds * surf.dash.driftPerSecond,
    };
  });
}

function swashOf(inputs: LiveInputs): LiveSwash {
  const swash = SHORE_SURF.swash;
  return {
    distanceM:
      swash.distanceM +
      swash.breathM * Math.sin((inputs.timeSeconds * RADIANS_PER_FULL_TURN) / SHORE_SURF.periodSeconds),
    laceWidthM: Math.max(swash.laceMinM, swash.laceWidthPx / inputs.pixelsPerMetre),
    laceTileWeight: trueTileWeight(inputs.pixelsPerMetre, swash.laceTileM),
  };
}

/** The farthest out a visible breaker can paint: its distance at the widest wander, plus half its widest stroke. */
export function breakerReach(breakers: readonly LiveBreaker[]): number {
  const surf = SHORE_SURF;
  let reach = 0;
  for (const breaker of breakers) {
    if (breaker.alpha <= 0) continue;
    reach = Math.max(reach, breaker.distanceM * (1 + surf.wander) + breaker.widthM * surf.band.widthShare * HALF);
  }
  return reach;
}

/** The live sea at `inputs`. */
export function shoreLiveFrame(inputs: LiveInputs): ShoreLiveFrame {
  const breakers = surfBreakers(inputs);
  const { ripples, glints } = rippleSheets(inputs);
  return {
    floor: {
      tileM: SHORE_SEABED.tileM,
      turn: 0,
      offsetX: 0,
      offsetY: 0,
      alpha: smoothstep(SHORE_SEABED.fadeFromZoom, SHORE_SEABED.fadeToZoom, inputs.zoom) * SHORE_SEABED.alpha,
    },
    caustics: causticSheets(inputs),
    swell: swellSheet(inputs),
    ripples,
    glints,
    isSurfOn: inputs.zoom <= SHORE_SURF.belowZoom,
    breakers,
    breakerReachM: breakerReach(breakers),
    laceTileWeight: trueTileWeight(inputs.pixelsPerMetre, SHORE_SURF.lace.tileM),
    swash: swashOf(inputs),
  };
}
