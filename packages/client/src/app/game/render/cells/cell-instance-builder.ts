// From one frame's view, traits, terms, LOD and placements to the instance record the shader
// reads (docs/rendering/cells.md §2.3). Pure: a table of assignments, kept out of the render state so
// that class stays small. The engulf-warning ring (visual-style/motion-and-legibility.md §5) is decided here from the
// shared `canEngulf`, the same call the server and the HUD chip make; the relation ring's role arrives decided
// (`relationsFor`, docs/ui/hud.md §3.1.5) and only its px radius and the quad it needs are settled here.

import { SEAT_MARK_BEADS, canEngulf, type BalanceConfig, type CellView } from '@evolution/shared';
import {
  CELL_QUAD_EXTENT_RADII,
  ENGULF_WARNING_RING_MIN_PX,
  ENGULF_WARNING_RING_RADII,
  FAR_DOT_HALO_RADII,
  NUCLEUS_RADIUS,
  PREY_UNDER_FILM_ALPHA,
  RELATION_RING_MIN_GAP_PX,
  RELATION_RING_RADII,
  RELATION_RING_STROKE_PX,
  SPRINT_RIM_BRIGHTNESS,
  TOXIC_RING_LINE_GAP_PX,
  WARNING_RING_STROKE_PX,
} from '../constants';
import { RELATION_RING, type RelationRing } from '../../hud/format/relations-for';
import type { CellInstance } from './cell-instance';
import type { CellLod } from './cell-lod';
import type { CellTraitSummary } from './cell-traits';
import { REST_OWN_CELL_RING, type OwnCellRing } from './self-ring';
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
  /** The strip row, the phase in turns and the speckle seed, drawn once from the cell's cosmetic fork. */
  readonly cosmetic: { readonly stripRow: number; readonly phase: number; readonly speckleSeed: number };
  /** The whole instance's alpha (cell-deformation.ts). */
  readonly alpha: number;
  /** The warning ring's px radius (`warningRingPxFor`, already 0 below the far LOD threshold), 0 for none. */
  readonly warningRingPx: number;
  /** The cilia beat's accumulated phase in turns. */
  readonly ciliaPhase: number;
  /** The absorbed ghost's dash, 0 for a living cell. */
  readonly rimDash: number;
  /** The sprint ring (self-ring.ts); read only when `isOwn`, every other cell packs the rest ring. */
  readonly ownCellRing: OwnCellRing;
  /** The cell's relation to the own cell (`relationsFor`); `RELATION_RING.none` for no ring. */
  readonly relationRing: RelationRing;
}

const REST_RIM_BRIGHTNESS = 1;
const NO_WARNING_RING = 0;
const FULL_PASS_B = 1;
/** No nucleus ramp: the nucleoid and the protocell have no disc (visual-style/cells-and-organelles.md §3). */
const NO_NUCLEUS_DISC = 0;
/** A seat with no bead entry still shows one bead (visual-style/principles-and-palette.md §2). */
const DEFAULT_BEADS = 1;

/**
 * `ENGULF_WARNING_RING_RADII × r_px` with the px floor when `cell` can engulf `own` and the LOD still draws
 * the tells; 0 otherwise. The LOD gate lives here, not in the packing, so the quad never grows for an
 * undrawn ring (a far dot has no ring and no ring-sized quad).
 */
export function warningRingPxFor(
  cell: CellView,
  own: CellView | null,
  balance: Pick<BalanceConfig, 'absorption'>,
  lod: Pick<CellLod, 'hasTells' | 'screenRadiusPx'>,
): number {
  if (!lod.hasTells || own === null || own.id === cell.id || !canEngulf(cell, own, balance.absorption)) {
    return NO_WARNING_RING;
  }
  return Math.max(ENGULF_WARNING_RING_RADII * lod.screenRadiusPx, ENGULF_WARNING_RING_MIN_PX);
}

/** Centre to centre, the toxic ring's two lines: one stroke plus the clear gap, so the pair reads as two lines. */
export const RELATION_RING_LINE_PITCH_PX = RELATION_RING_STROKE_PX + TOXIC_RING_LINE_GAP_PX;

/** The relation ring a cell packs: its line radius and line count (docs/rendering/own-cell-indicators.md §10). */
export interface RelationRingPacking {
  readonly relationRingPx: number;
  readonly relationRingLines: number;
}

const NO_RELATION_RING: RelationRingPacking = { relationRingPx: 0, relationRingLines: RELATION_RING.none };

/**
 * `max(RELATION_RING_RADII × r_px, r_px + RELATION_RING_MIN_GAP_PX)` for a ringed cell while the LOD draws the tells;
 * none otherwise, and none on a cell with a warning ring (the threat ring is the only ring a threat carries).
 */
export function relationRingPackingFor(
  ring: RelationRing,
  lod: Pick<CellLod, 'hasTells' | 'screenRadiusPx'>,
  warningRingPx: number,
): RelationRingPacking {
  if (ring === RELATION_RING.none || !lod.hasTells || warningRingPx > 0) return NO_RELATION_RING;
  const { screenRadiusPx } = lod;
  const relationRingPx = Math.max(RELATION_RING_RADII * screenRadiusPx, screenRadiusPx + RELATION_RING_MIN_GAP_PX);
  return { relationRingPx, relationRingLines: ring };
}

/** Every ring a cell packs, in px: the warning ring and the relation ring. */
export interface CellRings extends RelationRingPacking {
  readonly warningRingPx: number;
}

const NO_RINGS: CellRings = { warningRingPx: 0, ...NO_RELATION_RING };

/** The outer edge of the outermost line a ring draws, px; 0 for no ring. */
function ringReachPx(rings: CellRings): number {
  const warningReach = rings.warningRingPx > 0 ? rings.warningRingPx + WARNING_RING_STROKE_PX : 0;
  if (rings.relationRingPx <= 0) return warningReach;
  const outerLinePx = rings.relationRingPx + (rings.relationRingLines - 1) * RELATION_RING_LINE_PITCH_PX;
  return Math.max(warningReach, outerLinePx + RELATION_RING_STROKE_PX);
}

/** The quad reaches the profile's maximum, the far-dot halo or the outermost ring, never less than the §2 floor. */
export function quadExtentRadii(terms: ShapeTerms, lod: CellLod, rings: CellRings = NO_RINGS): number {
  const ringReach = ringReachPx(rings);
  const ringRadii = ringReach > 0 ? ringReach / lod.screenRadiusPx : 0;
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

/** The trait tells (visual-style/cells-and-organelles.md §4) and the form, straight from the summary; the tells snap off with the far dot. */
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

/** The film over an engulfed prey or a ghost, the ghost's dash and the warning ring (`warningRingPxFor` gated it). */
function filmFields(input: CellInstanceInput): Pick<CellInstance, 'passBAlpha' | 'rimDash' | 'warningRingPx'> {
  const isFilmed = input.view.engulfedByCellId !== null || input.rimDash > 0;
  return {
    passBAlpha: isFilmed ? PREY_UNDER_FILM_ALPHA : FULL_PASS_B,
    rimDash: input.rimDash,
    warningRingPx: input.warningRingPx,
  };
}

/** The own cell's sprint ring (docs/ui/hud.md §3.1.2); the shader draws no self ring elsewhere, so they pack the rest ring. */
function selfRingFields(input: CellInstanceInput): Pick<CellInstance, 'selfRingFill' | 'selfRingBrightness'> {
  const ring = input.isOwn ? input.ownCellRing : REST_OWN_CELL_RING;
  return { selfRingFill: ring.fill, selfRingBrightness: ring.brightness };
}

export function buildCellInstance(input: CellInstanceInput): CellInstance {
  const { view, traits, lod, terms } = input;
  const relation = relationRingPackingFor(input.relationRing, lod, input.warningRingPx);
  return {
    ...surfaceFields(terms, input.speedRatio),
    ...tellFields(traits, lod),
    ...filmFields(input),
    ...selfRingFields(input),
    ...relation,
    x: view.x,
    y: view.y,
    radius: view.radius,
    quadExtentRadii: quadExtentRadii(terms, lod, { warningRingPx: input.warningRingPx, ...relation }),
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
    speckleSeed: input.cosmetic.speckleSeed,
    lobesScale: terms.strip?.lobesScale ?? 0,
    jitterAmplitude: terms.strip?.jitterAmplitude ?? 0,
    ciliaPhase: input.ciliaPhase,
  };
}
