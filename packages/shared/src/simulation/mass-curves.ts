// The size and speed curves (docs/ECOLOGY.md §5.1), one home for the server movement step, the
// client prediction and the renderer's `speedRatio` (docs/RENDERING.md §1). Formulas take numbers
// from `balance.growth`, never a module constant (docs/ARCHITECTURE.md §3.3).

import type { BalanceConfig } from '../constants/balance.js';

export type GrowthCurveBalance = Pick<
  BalanceConfig['growth'],
  'CELL_RADIUS_SCALE' | 'CELL_BASE_SPEED' | 'CELL_MIN_SPEED' | 'CELL_STARTING_MASS' | 'CELL_SPEED_MASS_EXPONENT'
>;

/** `radius = CELL_RADIUS_SCALE × sqrt(mass)`: area is proportional to mass. */
export function radiusForMass(mass: number, growth: Pick<GrowthCurveBalance, 'CELL_RADIUS_SCALE'>): number {
  return growth.CELL_RADIUS_SCALE * Math.sqrt(Math.max(0, mass));
}

/** `maxSpeed = clamp(CELL_BASE_SPEED × (CELL_STARTING_MASS / mass) ^ exponent, CELL_MIN_SPEED, CELL_BASE_SPEED)`. */
export function maxSpeedForMass(mass: number, growth: GrowthCurveBalance): number {
  if (!(mass > 0)) {
    return growth.CELL_BASE_SPEED;
  }
  const raw = growth.CELL_BASE_SPEED * Math.pow(growth.CELL_STARTING_MASS / mass, growth.CELL_SPEED_MASS_EXPONENT);
  return Math.min(growth.CELL_BASE_SPEED, Math.max(growth.CELL_MIN_SPEED, raw));
}
