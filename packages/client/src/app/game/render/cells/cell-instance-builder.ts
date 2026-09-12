// From one frame's view, traits, terms, LOD and placements to the instance record the shader
// reads (docs/RENDERING.md §2.3). Pure: a table of assignments, kept out of the render state so
// that class stays small. The engulf-warning ring (VISUAL-STYLE §5) is decided here from the
// shared `canEngulf`, the same call the server and the HUD chip make.

import { SEAT_MARK_BEADS, canEngulf, type BalanceConfig, type CellView } from '@evolution/shared';
import {
  CELL_QUAD_EXTENT_RADII,
  ENGULF_WARNING_RING_MIN_PX,
  ENGULF_WARNING_RING_RADII,
  FAR_DOT_HALO_RADII,
  NUCLEUS_RADIUS,
  PREY_UNDER_FILM_ALPHA,
  SPRINT_RIM_BRIGHTNESS,
  WARNING_RING_STROKE_PX,
} from '../constants';
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
  /** The warning ring's px radius (`warningRingPxFor`), 0 for none. */
  readonly warningRingPx: number;
  /** The cilia beat's accumulated phase in turns. */
  readonly ciliaPhase: number;
  /** The absorbed ghost's dash, 0 for a living cell. */
  readonly rimDash: number;
}

const REST_RIM_BRIGHTNESS = 1;
const NO_WARNING_RING = 0;
const FULL_PASS_B = 1;
/** No nucleus ramp: the nucleoid and the protocell have no disc (VISUAL-STYLE §3). */
const NO_NUCLEUS_DISC = 0;
/** A seat with no bead entry still shows one bead (VISUAL-STYLE §2). */
const DEFAULT_BEADS = 1;

/** `ENGULF_WARNING_RING_RADII × r_px` with the px floor when `cell` can engulf `own`; 0 otherwise (or at far LOD). */
export function warningRingPxFor(
  cell: CellView,
  own: CellView | null,
  balance: Pick<BalanceConfig, 'absorption'>,
  screenRadiusPx: number,
): number {
  if (own === null || own.id === cell.id || !canEngulf(cell, own, balance.absorption)) return NO_WARNING_RING;
  return Math.max(ENGULF_WARNING_RING_RADII * screenRadiusPx, ENGULF_WARNING_RING_MIN_PX);
}

/** The quad reaches the profile's maximum, the far-dot halo or the warning ring, never less than the §2 floor. */
export function quadExtentRadii(terms: ShapeTerms, lod: CellLod, warningRingPx = 0, screenRadiusPx = 1): number {
  const ringRadii = warningRingPx > 0 ? (warningRingPx + WARNING_RING_STROKE_PX) / screenRadiusPx : 0;
  return Math.max(CELL_QUAD_EXTENT_RADII, terms.maxRadii, lod.isFarDot ? FAR_DOT_HALO_RADII : 0, ringRadii);
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

/** The trait tells (VISUAL-STYLE §4) and the form, straight from the summary; the tells snap off with the far dot. */
function tellFields(
  traits: CellTraitSummary,
  lod: CellLod,
): Pick<CellInstance, 'ciliaCount' | 'wallScale' | 'speckleDensity' | 'filamentCount' | 'tintMix' | 'formId'> {
  return {
    ciliaCount: lod.hasTells ? traits.ciliaCount : 0,
    wallScale: lod.hasTells ? traits.wallScale : 0,
    speckleDensity: traits.speckleDensity,
    filamentCount: traits.filamentCount,
    tintMix: traits.tintMix,
    formId: traits.form.id,
  };
}

/** The film over an engulfed prey or a ghost, the ghost's dash and the warning ring (only while the tells draw). */
function filmFields(input: CellInstanceInput): Pick<CellInstance, 'passBAlpha' | 'rimDash' | 'warningRingPx'> {
  const isFilmed = input.view.engulfedByCellId !== null || input.rimDash > 0;
  return {
    passBAlpha: isFilmed ? PREY_UNDER_FILM_ALPHA : FULL_PASS_B,
    rimDash: input.rimDash,
    warningRingPx: input.lod.hasTells ? input.warningRingPx : NO_WARNING_RING,
  };
}

export function buildCellInstance(input: CellInstanceInput): CellInstance {
  const { view, traits, lod, terms } = input;
  return {
    ...surfaceFields(terms, input.speedRatio),
    ...tellFields(traits, lod),
    ...filmFields(input),
    x: view.x,
    y: view.y,
    radius: view.radius,
    quadExtentRadii: quadExtentRadii(terms, lod, input.warningRingPx, lod.screenRadiusPx),
    paletteIndex: view.avatarIndex,
    lodBlend: lod.interiorBlend,
    rimBrightness: terms.isSprinting ? SPRINT_RIM_BRIGHTNESS : REST_RIM_BRIGHTNESS,
    nucleusOffsetX: input.nucleusOffset.x,
    nucleusOffsetY: input.nucleusOffset.y,
    nucleusDiscRadii: traits.hasNucleus ? NUCLEUS_RADIUS : NO_NUCLEUS_DISC,
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
    ciliaPhase: input.ciliaPhase,
  };
}
