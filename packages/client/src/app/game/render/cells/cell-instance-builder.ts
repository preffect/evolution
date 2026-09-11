// From one frame's view, traits, terms, LOD and clip values to the instance record the shader
// reads (docs/RENDERING.md §2.3). Pure: a table of assignments, kept out of the render state so
// that class stays small.

import { SEAT_MARK_BEADS, type CellView } from '@evolution/shared';
import { CILIA_BEAT_HZ, CILIA_BEAT_IDLE_HZ } from '../constants';
import type { ClipFrameValues } from './cell-clips';
import type { CellInstance } from './cell-instance';
import type { CellLod } from './cell-lod';
import type { CellTraitSummary } from './cell-traits';
import type { ShapeTerms } from './shape-terms';

export interface CellInstanceInput {
  readonly view: CellView;
  readonly traits: CellTraitSummary;
  readonly terms: ShapeTerms;
  readonly lod: CellLod;
  readonly clips: ClipFrameValues;
  readonly speedRatio: number;
  readonly warningRingPx: number;
  /** The mapped nucleus slot, fractions of `r`. */
  readonly nucleusOffset: { readonly x: number; readonly y: number };
  readonly isOwn: boolean;
  readonly cosmetic: { readonly stripRow: number; readonly phase: number };
  readonly zoom: number;
}

/** The quad reaches the profile's maximum, the bloomed halo and the warning ring, whichever is largest (§2). */
function quadExtentRadii(input: CellInstanceInput): number {
  const ringRadii = input.warningRingPx / (input.view.radius * input.zoom);
  return Math.max(input.terms.maxRadii, input.clips.quadExtentRadii, ringRadii);
}

/** The membrane's terms: heading, stretch, pulse, breathing, wobble and the bump slots. */
function surfaceFields(
  input: CellInstanceInput,
): Pick<
  CellInstance,
  | 'heading'
  | 'speedRatio'
  | 'breathing'
  | 'wobbleAmplitude'
  | 'wobbleMode'
  | 'wobblePhase'
  | 'axialAlong'
  | 'axialAcross'
  | 'pulse'
  | 'bumps'
> {
  const { terms } = input;
  return {
    heading: terms.heading,
    speedRatio: input.speedRatio,
    breathing: terms.breathing,
    wobbleAmplitude: terms.wobble.amplitude,
    wobbleMode: terms.wobble.mode,
    wobblePhase: terms.wobble.phase,
    axialAlong: terms.stretch.axialAlong,
    axialAcross: terms.stretch.axialAcross,
    pulse: terms.pulse,
    bumps: terms.bumps,
  };
}

export function buildCellInstance(input: CellInstanceInput): CellInstance {
  const { view, traits, lod, clips, terms } = input;
  return {
    ...surfaceFields(input),
    x: view.x,
    y: view.y,
    radius: view.radius,
    quadExtentRadii: quadExtentRadii(input),
    paletteIndex: view.avatarIndex,
    lodBlend: lod.interiorBlend,
    ciliaCount: traits.ciliaCount,
    wallScale: traits.wallScale,
    speckleDensity: traits.speckleDensity,
    filamentCount: traits.filamentCount,
    tintMix: traits.tintMix,
    nucleusOffsetX: input.nucleusOffset.x,
    nucleusOffsetY: input.nucleusOffset.y,
    haloKind: traits.haloKind,
    beadCount: lod.hasTells ? (SEAT_MARK_BEADS[view.avatarIndex] ?? 1) : 0,
    isOwn: input.isOwn && lod.hasTells,
    warningRingPx: input.warningRingPx,
    selfRingFill: 1,
    alpha: clips.alpha,
    stripRow: input.cosmetic.stripRow,
    stripPhase: input.cosmetic.phase,
    rimBrightness: clips.rimBrightness,
    passBAlpha: clips.passBAlpha,
    isFarDot: lod.isFarDot,
    isProtocell: traits.isProtocell,
    ciliaBeatHz: input.speedRatio > 0 ? CILIA_BEAT_HZ : CILIA_BEAT_IDLE_HZ,
    haloRadiiScale: clips.haloRadiiScale,
    lobesScale: terms.strip?.lobesScale ?? 0,
    jitterAmplitude: terms.strip?.jitterAmplitude ?? 0,
    rimDash: clips.rimDash,
  };
}
