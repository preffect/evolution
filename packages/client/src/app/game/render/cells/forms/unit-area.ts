// The unit-area rule every form obeys (docs/rendering/cells.md §2.4): `∫ B² dΔ / 2π` sampled round the turn, and the
// scale that brings a raw silhouette to it, so the drawn area equals the blob's `π r²` and mass ∝ area holds.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { FORM_AREA_SAMPLES } from '../../constants';

/** `∫ B² dΔ / 2π` of `valueAt`: exactly 1 for a unit-area form. */
export function meanSquareRadius(valueAt: (delta: number) => number): number {
  let sum = 0;
  for (let index = 0; index < FORM_AREA_SAMPLES; index += 1) {
    const value = valueAt((index / FORM_AREA_SAMPLES) * RADIANS_PER_FULL_TURN - Math.PI);
    sum += value * value;
  }
  return sum / FORM_AREA_SAMPLES;
}

/** The scale that gives the silhouette `valueAt` the unit disc's area. */
export function unitAreaScale(valueAt: (delta: number) => number): number {
  return 1 / Math.sqrt(meanSquareRadius(valueAt));
}
