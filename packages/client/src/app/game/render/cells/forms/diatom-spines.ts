// The diatom's spines (#195, #646; docs/rendering/cells.md §2.4, docs/visual-style/motion-and-legibility.md §5.1): the
// form's appendage, 8 / 12 / 16 straight radial spikes evenly round the round valve, the first on the heading, reaching
// far past the 1.3 r rings. Each is rooted `DIATOM_SPINE_ROOT_INSET_RADII` inside the membrane and reaches
// `DIATOM_SPINE_REACH_RADII` past it, tapering to a round, bright tip. The valve is rigid, so the spines neither beat nor
// retract: they turn with the heading and nothing else moves them. Cosmetic: no reach, no collision, no mass. This file
// is the TypeScript reference; `cell-shader-diatom.ts` paints the same spines term for term.

import { RADIANS_PER_FULL_TURN, tierEntryOf, type TraitTier } from '@evolution/shared';
import {
  DIATOM_SPINE_COUNT_BY_TIER,
  DIATOM_SPINE_REACH_RADII,
  DIATOM_SPINE_ROOT_INSET_RADII,
  DIATOM_SPINE_ROOT_WIDTH_RADII,
  DIATOM_SPINE_TIP_GLOW_RADII,
  DIATOM_SPINE_TIP_WIDTH_RADII,
  FORM_ID,
} from '../../constants';
import { HALF } from '../../geometry';
import type { FormDefinition } from './form-profiles';

/** A spine's length, root to tip: the inset plus the reach past the membrane. */
export const DIATOM_SPINE_LENGTH_RADII = DIATOM_SPINE_ROOT_INSET_RADII + DIATOM_SPINE_REACH_RADII;
/** The round tip's radius. */
export const DIATOM_SPINE_TIP_CAP_RADII = DIATOM_SPINE_TIP_WIDTH_RADII * HALF;
/** Where a spine leaves the body, as a share of its length, and its neck, halfway out along the part past it. */
export const DIATOM_SPINE_MEMBRANE_SHARE = DIATOM_SPINE_ROOT_INSET_RADII / DIATOM_SPINE_LENGTH_RADII;
export const DIATOM_SPINE_NECK_SHARE = (DIATOM_SPINE_MEMBRANE_SHARE + 1) * HALF;
/** The spine table past its end falls back to its tier-I count. */
const [TIER_I_SPINES] = DIATOM_SPINE_COUNT_BY_TIER;

/** Spines at `tier` for a diatom; 0 for every other form. */
export function diatomSpineCount(form: FormDefinition, tier: TraitTier): number {
  if (form.id !== FORM_ID.diatom) return 0;
  return tierEntryOf(DIATOM_SPINE_COUNT_BY_TIER, tier) ?? TIER_I_SPINES;
}

/** Spine `index` of `count` on a cell heading `heading`: its angle in the cell frame, the first on the heading. */
export function spineAngle(index: number, count: number, heading: number): number {
  return heading + (index * RADIANS_PER_FULL_TURN) / count;
}

/** A spine's width at `share` of the way from its root to its tip, radii: a straight taper. */
export function spineWidthRadii(share: number): number {
  return DIATOM_SPINE_ROOT_WIDTH_RADII + (DIATOM_SPINE_TIP_WIDTH_RADII - DIATOM_SPINE_ROOT_WIDTH_RADII) * share;
}

/** A point in the cell frame, radii from the centre. */
export interface CellPoint {
  readonly x: number;
  readonly y: number;
}

/** How far a spine's tip sits from the centre on a membrane `membraneRadii` out. */
export function spineTipRadii(membraneRadii: number): number {
  return membraneRadii + DIATOM_SPINE_REACH_RADII;
}

/**
 * Whether `point` lies on the spine at `angle` over a membrane `membraneRadii` out: past its root and within the taper's
 * half-width of its axis, or within the round tip past its end. The spine is straight and radial, so the distance off
 * its axis is already square across it.
 */
export function isOnSpine(point: CellPoint, angle: number, membraneRadii: number): boolean {
  const along = point.x * Math.cos(angle) + point.y * Math.sin(angle);
  const across = point.y * Math.cos(angle) - point.x * Math.sin(angle);
  const offset = along - (membraneRadii - DIATOM_SPINE_ROOT_INSET_RADII);
  if (offset < 0) return false;
  if (offset > DIATOM_SPINE_LENGTH_RADII) {
    return Math.hypot(offset - DIATOM_SPINE_LENGTH_RADII, across) <= DIATOM_SPINE_TIP_CAP_RADII;
  }
  return Math.abs(across) <= spineWidthRadii(offset / DIATOM_SPINE_LENGTH_RADII) * HALF;
}

/**
 * How far past the centre the spines can draw on a membrane at most `membraneRadii` out, radii: the tip, plus its round
 * cap or its glow, whichever is wider; 0 for a form without spines. What the quad (`shape-terms.ts`) and the lens
 * (`cell-draw-extent.ts`) count for the diatom (§5.1 rule 5).
 */
export function spineDrawnReachRadii(form: FormDefinition, membraneRadii: number): number {
  if (form.id !== FORM_ID.diatom) return 0;
  return spineTipRadii(membraneRadii) + Math.max(DIATOM_SPINE_TIP_CAP_RADII, DIATOM_SPINE_TIP_GLOW_RADII);
}
