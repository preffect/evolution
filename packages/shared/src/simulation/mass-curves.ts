// The size and gel curves (docs/ecology/mass-and-movement.md §5.1, §5.2; top speed does not depend on mass, #677):
// one home, read by the server movement step and by the client prediction and HUD. Formulas take numbers from
// `balance.growth`, never module constants (docs/architecture/server-simulation.md §3.3).

import type { BalanceConfig } from '../constants/balance.js';
import { clamp } from '../types/common.js';

export type GrowthBalance = BalanceConfig['growth'];

/** `radius = CELL_RADIUS_SCALE × √mass`: area is proportional to mass. */
export function radiusForMass(mass: number, growth: Pick<GrowthBalance, 'CELL_RADIUS_SCALE'>): number {
  return growth.CELL_RADIUS_SCALE * Math.sqrt(mass);
}

export type GelCurveBalance = Pick<GrowthBalance, 'GEL_MASS_SCALE' | 'GEL_MIN_SPEED_FACTOR' | 'GEL_MAX_SPEED_FACTOR'>;

/**
 * `max(clamp(1 − mass / GEL_MASS_SCALE, GEL_MIN_SPEED_FACTOR, GEL_MAX_SPEED_FACTOR), floor)`: the gel
 * barely slows a starting cell and cuts a heavy one; `floor` is the folded `gelSpeedFactorFloor`.
 */
export function gelSpeedFactor(mass: number, growth: GelCurveBalance, floor: number): number {
  const factor = clamp(1 - mass / growth.GEL_MASS_SCALE, growth.GEL_MIN_SPEED_FACTOR, growth.GEL_MAX_SPEED_FACTOR);
  return Math.max(factor, floor);
}
