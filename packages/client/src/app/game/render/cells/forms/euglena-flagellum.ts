// The euglena's leading flagellum (#194, #646; docs/rendering/cells.md §2.4, docs/visual-style/motion-and-legibility.md
// §5.1): the form's appendage, one thick whip out of the spindle's nose, reaching far past the 1.3 r rings. It lies
// along the heading: its root sits `EUGLENA_FLAGELLUM_ROOT_INSET_RADII` inside the nose, its tip
// `EUGLENA_FLAGELLUM_REACH_RADII` past it, and a travelling wave swings it sideways, from nothing at the root to
// `EUGLENA_FLAGELLUM_AMPLITUDE_RADII` at the tip, one wavelength per turn of the cell's beat. It tapers from its root to
// a round tip, its width measured square across it. Cosmetic: no reach, no collision, no mass. This file is the
// TypeScript reference; `cell-shader-euglena.ts` paints the same whip term for term.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import {
  EUGLENA_FLAGELLUM_AMPLITUDE_RADII,
  EUGLENA_FLAGELLUM_REACH_RADII,
  EUGLENA_FLAGELLUM_ROOT_INSET_RADII,
  EUGLENA_FLAGELLUM_ROOT_WIDTH_RADII,
  EUGLENA_FLAGELLUM_TIP_WIDTH_RADII,
  EUGLENA_FLAGELLUM_WAVES,
  FORM_ID,
} from '../../constants';
import { HALF } from '../../geometry';
import { stretchAt, type RadialProfileTerms } from '../radial-profile';
import type { FormDefinition } from './form-profiles';

/** The whip's length along the heading, root to tip: the inset plus the reach past the nose. */
export const EUGLENA_FLAGELLUM_LENGTH_RADII = EUGLENA_FLAGELLUM_ROOT_INSET_RADII + EUGLENA_FLAGELLUM_REACH_RADII;
/** The round tip's radius. */
export const EUGLENA_FLAGELLUM_TIP_CAP_RADII = EUGLENA_FLAGELLUM_TIP_WIDTH_RADII * HALF;

/** The whip's centre line at `share` of the way from root to tip: its sideways offset and its slope, both in radii. */
export interface FlagellumCentre {
  readonly across: number;
  readonly slope: number;
}

/**
 * The centre line at `share` (0 at the root, 1 at the tip) at `beatPhase` turns: `A · t · sin(2π(W t − beat))`, the
 * wave running from the root toward the tip as the beat turns.
 */
export function flagellumCentreAt(share: number, beatPhase: number): FlagellumCentre {
  const wave = RADIANS_PER_FULL_TURN * (EUGLENA_FLAGELLUM_WAVES * share - beatPhase);
  const across = EUGLENA_FLAGELLUM_AMPLITUDE_RADII * share * Math.sin(wave);
  const acrossPerShare =
    EUGLENA_FLAGELLUM_AMPLITUDE_RADII *
    (Math.sin(wave) + share * RADIANS_PER_FULL_TURN * EUGLENA_FLAGELLUM_WAVES * Math.cos(wave));
  return { across, slope: acrossPerShare / EUGLENA_FLAGELLUM_LENGTH_RADII };
}

/** The whip's width at `share` of the way from its root to its tip, radii: a straight taper. */
export function flagellumWidthRadii(share: number): number {
  return (
    EUGLENA_FLAGELLUM_ROOT_WIDTH_RADII +
    (EUGLENA_FLAGELLUM_TIP_WIDTH_RADII - EUGLENA_FLAGELLUM_ROOT_WIDTH_RADII) * share
  );
}

/** Where the whip leaves the body: the share of its length at the nose, and the share halfway out past it (its neck). */
export const EUGLENA_FLAGELLUM_NOSE_SHARE = EUGLENA_FLAGELLUM_ROOT_INSET_RADII / EUGLENA_FLAGELLUM_LENGTH_RADII;
export const EUGLENA_FLAGELLUM_NECK_SHARE = (EUGLENA_FLAGELLUM_NOSE_SHARE + 1) * HALF;

/** The nose's distance from the centre this frame, radii: the spindle's tip under the pulse and the stretch. */
export function noseRadii(terms: Pick<RadialProfileTerms, 'form' | 'pulse' | 'stretch'>): number {
  const form = terms.form === null ? 1 : terms.form.evaluate(0).value;
  return terms.pulse * form * stretchAt(terms.stretch, 0).value;
}

/** A point beside the cell in the heading frame, radii: `along` the heading and `across` it. */
export interface HeadingPoint {
  readonly along: number;
  readonly across: number;
}

/** The whip's tip at `beatPhase` for a nose `nose` radii out, in the heading frame. */
export function flagellumTipAt(nose: number, beatPhase: number): HeadingPoint {
  return {
    along: nose - EUGLENA_FLAGELLUM_ROOT_INSET_RADII + EUGLENA_FLAGELLUM_LENGTH_RADII,
    across: flagellumCentreAt(1, beatPhase).across,
  };
}

/**
 * Whether `point` lies on the whip for a nose `nose` radii out: within the taper's half-width of the centre line,
 * measured square across it (the offset over `√(1 + slope²)`), or within the round tip past its end.
 */
export function isOnFlagellum(point: HeadingPoint, nose: number, beatPhase: number): boolean {
  const offset = point.along - (nose - EUGLENA_FLAGELLUM_ROOT_INSET_RADII);
  if (offset < 0) return false;
  if (offset > EUGLENA_FLAGELLUM_LENGTH_RADII) {
    const tip = flagellumTipAt(nose, beatPhase);
    return Math.hypot(point.along - tip.along, point.across - tip.across) <= EUGLENA_FLAGELLUM_TIP_CAP_RADII;
  }
  const share = offset / EUGLENA_FLAGELLUM_LENGTH_RADII;
  const centre = flagellumCentreAt(share, beatPhase);
  const square = Math.abs(point.across - centre.across) / Math.sqrt(1 + centre.slope * centre.slope);
  return square <= flagellumWidthRadii(share) * HALF;
}

/**
 * How far past the centre the whip can draw on a membrane at most `membraneRadii` out, radii: the tip at its full
 * swing, plus its round cap; 0 for a form without one. What the quad (`shape-terms.ts`) and the lens
 * (`cell-draw-extent.ts`) count for the euglena (§5.1 rule 5).
 */
export function flagellumDrawnReachRadii(form: FormDefinition, membraneRadii: number): number {
  if (form.id !== FORM_ID.spindle) return 0;
  return (
    Math.hypot(membraneRadii + EUGLENA_FLAGELLUM_REACH_RADII, EUGLENA_FLAGELLUM_AMPLITUDE_RADII) +
    EUGLENA_FLAGELLUM_TIP_CAP_RADII
  );
}
