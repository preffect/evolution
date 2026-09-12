// How an organelle sprite moves on its slot (docs/VISUAL-STYLE.md §4): the mitochondrion pulses
// on sprint, the toxin bladder breathes at 1 Hz, the vacuoles rise and pop every two seconds.
// Pure: kind, phase and time in; scale, alpha and lift out.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { FOOD_VACUOLE, MITOCHONDRION, ORGANELLE_KIND, TOXIN_VACUOLE, type OrganelleKind } from '../constants';
import { HALF, wrapUnit } from '../geometry';

export interface OrganelleMotion {
  readonly scale: number;
  readonly alpha: number;
  /** Rise along the cell's up (negative y), fractions of `r`. */
  readonly lift: number;
}

/** No motion at all: the sprite sits on its slot at full size and alpha (a ghost's draw, #243). */
export const ORGANELLE_MOTION_AT_REST: OrganelleMotion = { scale: 1, alpha: 1, lift: 0 };
const REST = ORGANELLE_MOTION_AT_REST;

/** Grows from `growFromScale` to 1 over the cycle, rises, and fades over the last `popShare`. */
function vacuoleMotion(phase: number, timeSeconds: number): OrganelleMotion {
  const cycle = wrapUnit(timeSeconds / FOOD_VACUOLE.cycleSeconds + phase);
  const popStart = 1 - FOOD_VACUOLE.popShare;
  const alpha = cycle < popStart ? 1 : 1 - (cycle - popStart) / FOOD_VACUOLE.popShare;
  const scale = FOOD_VACUOLE.growFromScale + cycle * (1 - FOOD_VACUOLE.growFromScale);
  return { scale, alpha, lift: -cycle * FOOD_VACUOLE.riseRadii };
}

function toxinMotion(phase: number, timeSeconds: number): OrganelleMotion {
  const breath = (Math.sin(RADIANS_PER_FULL_TURN * (timeSeconds * TOXIN_VACUOLE.pulseHz + phase)) + 1) * HALF;
  return { ...REST, scale: 1 + (TOXIN_VACUOLE.pulseScale - 1) * breath };
}

export function organelleMotion(
  kind: OrganelleKind,
  phase: number,
  timeSeconds: number,
  isSprinting: boolean,
): OrganelleMotion {
  switch (kind) {
    case ORGANELLE_KIND.mitochondrion:
      return isSprinting ? { ...REST, scale: MITOCHONDRION.sprintScale } : REST;
    case ORGANELLE_KIND.toxinVacuole:
      return toxinMotion(phase, timeSeconds);
    case ORGANELLE_KIND.foodVacuole:
      return vacuoleMotion(phase, timeSeconds);
    default:
      return REST;
  }
}
