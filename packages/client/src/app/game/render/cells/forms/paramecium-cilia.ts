// The paramecium's cilia tufts (#193, #646; docs/rendering/cells.md §2.4, docs/visual-style/motion-and-legibility.md
// §5.1): the form's appendage, `CILIA_TUFT_COUNT` bold tufts round the whole slipper reaching well past the 1.3 r
// rings. Each tuft is a tapered, round-tipped band rooted on the membrane and measured **radially** out from it, so
// its tip sits exactly `length` past the membrane at the tip's own angle. The tufts sit evenly along the outline
// (the spacing parameter `φ`, a middle way between the polar angle and the ellipse's own parameter), beat in a
// metachronal wave from the nose to the tail down both flanks, and bend back toward the tail as they beat, further
// with speed. Cosmetic: no reach, no collision, no mass. This file is the TypeScript reference;
// `cell-shader-fringe.ts` paints the same tufts term for term.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import {
  CILIA_TUFT_BEAT_SWING_DEG,
  CILIA_TUFT_COUNT,
  CILIA_TUFT_LEAN_DEG,
  CILIA_TUFT_REACH_RADII,
  CILIA_TUFT_RETRACTED_SHARE,
  CILIA_TUFT_ROOT_WIDTH_RADII,
  CILIA_TUFT_SIDE_GAIN,
  CILIA_TUFT_SPEED_LEAN_DEG,
  CILIA_TUFT_TIP_WIDTH_RADII,
  CILIA_TUFT_WAVES_PER_FLANK,
  FORM_ID,
} from '../../constants';
import { HALF, SQUARE_DERIVATIVE_FACTOR, degreesToRadians, wrapAngle } from '../../geometry';
import type { FormDefinition } from './form-profiles';

const TUFT_STEP = RADIANS_PER_FULL_TURN / CILIA_TUFT_COUNT;
const LEAN = degreesToRadians(CILIA_TUFT_LEAN_DEG);
const SPEED_LEAN = degreesToRadians(CILIA_TUFT_SPEED_LEAN_DEG);
const BEAT_SWING = degreesToRadians(CILIA_TUFT_BEAT_SWING_DEG);
const REACHING_SHARE = 1 - CILIA_TUFT_RETRACTED_SHARE;
const TIP_CAP_RADII = CILIA_TUFT_TIP_WIDTH_RADII * HALF;

/** One tuft at one moment, in the heading frame. */
export interface CiliaTuft {
  /** Where it is rooted, radians off the heading. */
  readonly delta: number;
  /** How far its tip reaches past the membrane, radially, in radii. */
  readonly lengthRadii: number;
  /** Its tip's lean toward the tail off the radial direction, radians: positive turns it toward larger `Δ`. */
  readonly lean: number;
}

/** The spacing parameter's stretch: `√aspect`, so the tufts sit near-evenly along the slipper's outline. */
export function tuftSpacingStretch(aspect: number): number {
  return Math.sqrt(aspect);
}

/** `Δ → φ`: the spacing parameter at a heading-frame angle. */
export function tuftParameterAt(delta: number, aspect: number): number {
  return Math.atan2(tuftSpacingStretch(aspect) * Math.sin(delta), Math.cos(delta));
}

/** `φ → Δ`, the inverse. */
function deltaAtParameter(parameter: number, aspect: number): number {
  return Math.atan2(Math.sin(parameter), tuftSpacingStretch(aspect) * Math.cos(parameter));
}

/** The beat's phase in turns at tuft parameter `φ`: the wave leaves the nose and runs down both flanks to the tail. */
function beatTurns(parameter: number, ciliaPhase: number): number {
  return ciliaPhase - (CILIA_TUFT_WAVES_PER_FLANK * Math.abs(parameter)) / Math.PI;
}

/** The cell's beat and speed: the cilia phase in turns (`CellInstance.ciliaPhase`) and the speed ratio. */
export interface TuftMotion {
  readonly ciliaPhase: number;
  readonly speedRatio: number;
}

/** The tuft's anchor on the spacing parameter: half a step off the axis, so the nose and the tail sit between two. */
export function tuftParameterOf(index: number): number {
  return wrapAngle((index + HALF) * TUFT_STEP);
}

/** How much of the lean a tuft at `φ` takes: all of it on the flanks, fading toward the axis, signed by its side. */
function sideWeight(parameter: number): number {
  return Math.max(-1, Math.min(1, CILIA_TUFT_SIDE_GAIN * Math.sin(parameter)));
}

/** Tuft `index` at this moment of the beat. */
export function ciliaTuftAt(index: number, aspect: number, motion: TuftMotion): CiliaTuft {
  const parameter = tuftParameterOf(index);
  const beat = RADIANS_PER_FULL_TURN * beatTurns(parameter, motion.ciliaPhase);
  const extension = CILIA_TUFT_RETRACTED_SHARE + REACHING_SHARE * (HALF + HALF * Math.sin(beat));
  const lean = LEAN + SPEED_LEAN * motion.speedRatio + BEAT_SWING * Math.cos(beat);
  return {
    delta: deltaAtParameter(parameter, aspect),
    lengthRadii: CILIA_TUFT_REACH_RADII * extension,
    lean: lean * sideWeight(parameter),
  };
}

/** Every tuft at this moment of the beat. */
export function ciliaTufts(aspect: number, motion: TuftMotion): CiliaTuft[] {
  return Array.from({ length: CILIA_TUFT_COUNT }, (_unused, index) => ciliaTuftAt(index, aspect, motion));
}

/** The tuft's width at `share` of the way from its root to its tip, radii: a straight taper. */
export function ciliaTuftWidthRadii(share: number): number {
  return CILIA_TUFT_ROOT_WIDTH_RADII + (CILIA_TUFT_TIP_WIDTH_RADII - CILIA_TUFT_ROOT_WIDTH_RADII) * share;
}

/** How far sideways a tuft's centre line has swept at `offsetRadii` out: `tan(lean)` of the full reach at it. */
function tuftSweepRadii(tuft: CiliaTuft, offsetRadii: number): number {
  return (Math.tan(tuft.lean) * offsetRadii * offsetRadii) / CILIA_TUFT_REACH_RADII;
}

/**
 * How far round a tuft's centre line has turned from its root at `offsetRadii` out, radians: it leaves the membrane
 * square and bends back, its sideways sweep growing with the square of the offset.
 */
export function tuftCentreTurn(tuft: CiliaTuft, rootRadii: number, offsetRadii: number): number {
  return Math.atan(tuftSweepRadii(tuft, offsetRadii) / (rootRadii + offsetRadii));
}

/**
 * How much wider a bent tuft is along the arc than square across it at `offsetRadii` out: `√(1 + slope²)` of its
 * centre line's sideways slope there, so the taper's width holds square across the tuft however far it bends.
 */
export function tuftArcWidening(tuft: CiliaTuft, offsetRadii: number): number {
  const slope = (SQUARE_DERIVATIVE_FACTOR * Math.tan(tuft.lean) * offsetRadii) / CILIA_TUFT_REACH_RADII;
  return Math.sqrt(1 + slope * slope);
}

/** A point beside the cell in the heading frame: its angle, its distance and the membrane's there, both in radii. */
export interface FringePoint {
  readonly delta: number;
  readonly radiusRadii: number;
  readonly membraneRadii: number;
}

/**
 * Whether `point` lies inside `tuft`: past the membrane, short of the tip's round cap, and within the taper's
 * half-width (square across the bent tuft, so widened along the arc) of its centre line, measured along the arc at
 * the point's radius. The bend turns about the membrane under the point, which the shader has to hand without
 * another profile walk.
 */
export function isInsideTuft(point: FringePoint, tuft: CiliaTuft): boolean {
  const offset = point.radiusRadii - point.membraneRadii;
  if (offset < 0) return false;
  const along = Math.min(offset, tuft.lengthRadii);
  const centre = tuft.delta + tuftCentreTurn(tuft, point.membraneRadii, along);
  const across = Math.abs(wrapAngle(point.delta - centre)) * point.radiusRadii;
  const widening = tuftArcWidening(tuft, along);
  if (offset > tuft.lengthRadii) return Math.hypot(offset - tuft.lengthRadii, across / widening) <= TIP_CAP_RADII;
  return across <= ciliaTuftWidthRadii(offset / tuft.lengthRadii) * HALF * widening;
}

/**
 * A reach with the form's tufts counted: `reachRadii` (the halo, the hairs), or the tufts' round tips past the widest
 * membrane `membraneRadii` if they reach further. What the quad (`shape-terms.ts`) and the lens (`cell-draw-extent.ts`)
 * add for the paramecium (§5.1 rule 5).
 */
export function reachWithCiliaTufts(form: FormDefinition, reachRadii: number, membraneRadii: number): number {
  const tufts = ciliaTuftDrawnReachRadii(form);
  return tufts > 0 ? Math.max(reachRadii, membraneRadii + tufts) : reachRadii;
}

/** How far past the widest membrane a form's tufts draw, radii: the full reach and the tip's cap; 0 without tufts. */
export function ciliaTuftDrawnReachRadii(form: FormDefinition): number {
  return form.id === FORM_ID.slipper ? CILIA_TUFT_REACH_RADII + TIP_CAP_RADII : 0;
}
