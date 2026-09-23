// Everything the movement kernel's step is built from (docs/ecology/mass-and-movement.md §5.2): the speed cap
// `maxSpeed(mass) × sprint × zone × trait × engulf` and the steer blend. One home for the server's movement system
// and the client's own-cell prediction (docs/architecture/client.md §5), so the two can never fold the cap apart.
// The caller resolves what only it can see (is the cell in a gel patch, what does its engulf pair cost it).

import type { BalanceConfig } from '../constants/balance.js';
import { TICK_INTERVAL_S } from '../constants/network.js';
import type { CellModifiers } from '../types/traits.js';
import { gelSpeedFactor, maxSpeedForMass } from './mass-curves.js';
import { steerBlendPerTick, type MovementStep } from './movement-kernel.js';

/** The modifiers the speed cap and the blend read. */
export type MovementModifiers = Pick<
  CellModifiers,
  'speedMultiplier' | 'sprintSpeedMultiplierBonus' | 'gelSpeedFactorFloor' | 'accelerationSecondsMultiplier'
>;

/** One cell's movement-relevant state at the start of a tick. */
export interface MovementCellState {
  readonly mass: number;
  readonly radiusWu: number;
  readonly sprintRemainingTicks: number;
  readonly modifiers: MovementModifiers;
  /** The centre is inside a gel patch (`zoneAt(...) === ZONE_ID.viscousGel`). */
  readonly isInGel: boolean;
  /** docs/ecology/absorption.md §6.1: 1 for a cell that is neither engulfing nor engulfed. */
  readonly engulfFactor: number;
}

/** `SPRINT_SPEED_MULTIPLIER + sprintSpeedMultiplierBonus` while a sprint runs, 1 otherwise. */
export function sprintSpeedFactorFor(
  sprintRemainingTicks: number,
  sprintSpeedMultiplierBonus: number,
  controls: Pick<BalanceConfig['controls'], 'SPRINT_SPEED_MULTIPLIER'>,
): number {
  return sprintRemainingTicks > 0 ? controls.SPRINT_SPEED_MULTIPLIER + sprintSpeedMultiplierBonus : 1;
}

/** The gel factor inside a gel patch (with the amoeba floor), 1 elsewhere. */
export function gelZoneSpeedFactor(
  state: Pick<MovementCellState, 'mass' | 'isInGel' | 'modifiers'>,
  balance: BalanceConfig,
): number {
  return state.isInGel ? gelSpeedFactor(state.mass, balance.growth, state.modifiers.gelSpeedFactorFloor) : 1;
}

/** `maxSpeed(mass) × sprint × zone × trait × engulf` (wu/s). */
export function speedCapFor(state: MovementCellState, balance: BalanceConfig): number {
  return (
    maxSpeedForMass(state.mass, balance.growth) *
    sprintSpeedFactorFor(state.sprintRemainingTicks, state.modifiers.sprintSpeedMultiplierBonus, balance.controls) *
    gelZoneSpeedFactor(state, balance) *
    state.modifiers.speedMultiplier *
    state.engulfFactor
  );
}

/** The kernel's step for one cell steering at `target`: the cap, the derived blend and the dish. */
export function movementStepFor(
  state: MovementCellState,
  target: { readonly x: number; readonly y: number },
  balance: BalanceConfig,
): MovementStep {
  const accelerationSeconds = balance.growth.CELL_ACCELERATION_SECONDS * state.modifiers.accelerationSecondsMultiplier;
  return {
    targetX: target.x,
    targetY: target.y,
    radiusWu: state.radiusWu,
    speedCapWuPerSecond: speedCapFor(state, balance),
    blendPerTick: steerBlendPerTick(accelerationSeconds, TICK_INTERVAL_S),
    tickIntervalS: TICK_INTERVAL_S,
    dishRadiusWu: balance.world.DISH_RADIUS,
    controls: balance.controls,
  };
}
