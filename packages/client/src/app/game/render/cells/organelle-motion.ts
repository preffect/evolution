// How an organelle sprite moves on its slot (docs/VISUAL-STYLE.md §4): the mitochondrion pulses
// on sprint, the toxin bladder breathes at 1 Hz, the vacuoles rise and pop every two seconds.
// Pure: kind, phase and time in, scale, alpha and lift out.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { FOOD_VACUOLE, MITOCHONDRION, TOXIN_VACUOLE } from '../constants';
import { ORGANELLE_KIND, type OrganelleKind } from './organelle-kinds';

export interface OrganelleMotion {
  readonly scale: number;
  readonly alpha: number;
  /** Rise along the cell's up, fractions of `r`. */
  readonly lift: number;
}

const REST: OrganelleMotion = { scale: 1, alpha: 1, lift: 0 };
const HALF = 0.5;
/** A vacuole fades over the last share of its cycle as it pops. */
const POP_SHARE = 0.15;

function vacuoleMotion(phase: number, timeSeconds: number): OrganelleMotion {
  const cycle = (((timeSeconds / FOOD_VACUOLE.cycleSeconds + phase) % 1) + 1) % 1;
  const popStart = 1 - POP_SHARE;
  const alpha = cycle < popStart ? 1 : 1 - (cycle - popStart) / POP_SHARE;
  return { scale: HALF + cycle * HALF, alpha, lift: -cycle * FOOD_VACUOLE.riseRadii };
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
    case ORGANELLE_KIND.toxinVacuole: {
      const breath = (Math.sin(RADIANS_PER_FULL_TURN * (timeSeconds * TOXIN_VACUOLE.pulseHz + phase)) + 1) * HALF;
      return { ...REST, scale: 1 + (TOXIN_VACUOLE.pulseScale - 1) * breath };
    }
    case ORGANELLE_KIND.foodVacuole:
      return vacuoleMotion(phase, timeSeconds);
    default:
      return REST;
  }
}
