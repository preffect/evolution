// From one frame's view, traits, terms, LOD and placements to the instance record the shader
// reads (docs/RENDERING.md §2.3). Pure: a table of assignments, kept out of the render state so
// that class stays small.

import { SEAT_MARK_BEADS, type CellView } from '@evolution/shared';
import { CELL_QUAD_EXTENT_RADII, FAR_DOT_HALO_RADII, SPRINT_RIM_BRIGHTNESS } from '../constants';
import type { CellInstance } from './cell-instance';
import type { CellLod } from './cell-lod';
import type { CellTraitSummary } from './cell-traits';
import type { ShapeTerms } from './shape-terms';

export interface CellInstanceInput {
  readonly view: CellView;
  readonly traits: CellTraitSummary;
  readonly terms: ShapeTerms;
  readonly lod: CellLod;
  readonly speedRatio: number;
  /** The mapped nucleus slot, fractions of `r`; the origin when the cell has no nucleus sprite. */
  readonly nucleusOffset: { readonly x: number; readonly y: number };
  readonly isOwn: boolean;
  readonly cosmetic: { readonly stripRow: number; readonly phase: number };
  /** The whole instance's alpha (cell-deformation.ts). */
  readonly alpha: number;
}

const REST_RIM_BRIGHTNESS = 1;
/** A seat with no bead entry still shows one bead (VISUAL-STYLE §2). */
const DEFAULT_BEADS = 1;

/** The quad reaches the profile's maximum or the far-dot halo, never less than the §2 floor. */
export function quadExtentRadii(terms: ShapeTerms, lod: CellLod): number {
  return Math.max(CELL_QUAD_EXTENT_RADII, terms.maxRadii, lod.isFarDot ? FAR_DOT_HALO_RADII : 0);
}

/** The membrane's terms: heading, stretch, pulse, breathing, wobble and the bump slots. */
function surfaceFields(
  terms: ShapeTerms,
  speedRatio: number,
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
  return {
    heading: terms.heading,
    speedRatio,
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
  const { view, traits, lod, terms } = input;
  return {
    ...surfaceFields(terms, input.speedRatio),
    x: view.x,
    y: view.y,
    radius: view.radius,
    quadExtentRadii: quadExtentRadii(terms, lod),
    paletteIndex: view.avatarIndex,
    lodBlend: lod.interiorBlend,
    rimBrightness: terms.isSprinting ? SPRINT_RIM_BRIGHTNESS : REST_RIM_BRIGHTNESS,
    nucleusOffsetX: input.nucleusOffset.x,
    nucleusOffsetY: input.nucleusOffset.y,
    haloKind: traits.haloKind,
    beadCount: lod.hasTells ? (SEAT_MARK_BEADS[view.avatarIndex] ?? DEFAULT_BEADS) : 0,
    isOwn: input.isOwn && lod.hasTells,
    isFarDot: lod.isFarDot,
    isProtocell: traits.isProtocell,
    alpha: input.alpha,
    stripRow: input.cosmetic.stripRow,
    stripPhase: input.cosmetic.phase,
    lobesScale: terms.strip?.lobesScale ?? 0,
    jitterAmplitude: terms.strip?.jitterAmplitude ?? 0,
  };
}
