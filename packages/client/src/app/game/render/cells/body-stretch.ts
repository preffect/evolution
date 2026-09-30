// The speed stretch and the sprint's axial stretch a body wears (docs/rendering/cells.md §2.1): the term the profile, the
// reach bounds and the traced rings all take, and the one place a rigid form opts out of it (§2.4 diatom, #195).

import { SPRINT_STRETCH_SCALE, STRETCH_ACROSS_PER_ALONG, STRETCH_ALONG, STRETCH_TAPER } from '../constants';
import type { FormDefinition } from './forms/form-profiles';
import type { StretchTerm } from './radial-profile';

/** A rigid body at rest: no speed to stretch by. */
const STILL = 0;

export function stretchTerm(speedRatio: number, isSprinting: boolean): StretchTerm {
  return {
    k: speedRatio,
    along: STRETCH_ALONG,
    taper: STRETCH_TAPER,
    acrossPerAlong: STRETCH_ACROSS_PER_ALONG,
    axialAlong: isSprinting ? SPRINT_STRETCH_SCALE : 1,
    axialAcross: 1,
  };
}

/**
 * The stretch a body of `form` wears at this speed: a rigid valve keeps its shape whatever it does, so the diatom takes
 * neither the speed stretch nor the sprint's (docs/rendering/cells.md §2.4).
 */
export function bodyStretchTerm(form: FormDefinition, speedRatio: number, isSprinting: boolean): StretchTerm {
  return form.isRigid ? stretchTerm(STILL, false) : stretchTerm(speedRatio, isSprinting);
}

/** The widest the stretch scales a radius: the speed stretch along the heading, times the sprint's axial scale. */
export function stretchReach(stretch: StretchTerm): number {
  return Math.max(1, 1 + stretch.k * (stretch.along - 1)) * Math.max(1, stretch.axialAlong, stretch.axialAcross);
}

/** The widest the stretch scales a body of `form` at this speed, sprinting or not (the traced ring's reach bound, #730). */
export const peakStretchRadii = (form: FormDefinition, speedRatio: number, isSprinting: boolean): number =>
  stretchReach(bodyStretchTerm(form, speedRatio, isSprinting));
