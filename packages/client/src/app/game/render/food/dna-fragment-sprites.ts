// What a DNA fragment sprite looks like this frame (docs/VISUAL-STYLE.md §2, §5): the helix bake of
// its tag, spinning 20 °/s from a phase drawn once from the fragment's cosmetic fork so the field
// never turns in lockstep, sized by the bake's px per wu. Pure; the food layer applies it.

import { COSMETIC_SUB_STREAM, RADIANS_PER_FULL_TURN, type EntityId, type RandomSource } from '@evolution/shared';
import { DNA_FRAGMENT_ROTATION_DEG_PER_SECOND, MOTE_ATLAS_PX_PER_WU } from '../constants';
import { degreesToRadians } from '../geometry';

export interface FragmentAppearance {
  readonly rotation: number;
  readonly widthWu: number;
  readonly heightWu: number;
}

/** The spin phase in turns, from `fork(fragment + ':' + id)` of the round's cosmetic stream. */
export function drawFragmentSpinPhase(cosmetic: RandomSource, id: EntityId): number {
  return cosmetic.fork(`${COSMETIC_SUB_STREAM.fragment}:${id}`).nextFloat();
}

export function fragmentAppearance(
  spinPhase: number,
  timeSeconds: number,
  texturePx: { readonly width: number; readonly height: number },
): FragmentAppearance {
  return {
    rotation: spinPhase * RADIANS_PER_FULL_TURN + degreesToRadians(DNA_FRAGMENT_ROTATION_DEG_PER_SECOND) * timeSeconds,
    widthWu: texturePx.width / MOTE_ATLAS_PX_PER_WU,
    heightWu: texturePx.height / MOTE_ATLAS_PX_PER_WU,
  };
}
