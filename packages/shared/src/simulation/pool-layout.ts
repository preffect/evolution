// The rock pool's layout as shapes (docs/game-design/phases.md §14.5.2, §14.5.3): a view carries only what was drawn,
// so the shapes come from it and the live balance here, the one place the server, the shared movement step and the
// renderer read. The light patch's centre is a pure function of the tick and the orbit, so it needs no per-tick field.
// Pure: the layout was drawn once, from the `pool` stream, at the round's start.

import type { BalanceConfig } from '../constants/balance.js';
import { RADIANS_PER_FULL_TURN } from '../constants/units.js';
import { ticksToSeconds } from '../time/units.js';
import type { Vec2 } from '../types/common.js';
import type { LightPatchOrbitView, PoolThreadView } from '../types/pool.js';
import { pointOnCircle } from './vector-math.js';

/**
 * The light patch's centre on `tick`, a whole world tick on the server or the client's fractional render tick: `orbit`'s
 * start angle turned counter-clockwise by one full turn per `POOL_LIGHT_PATCH_PERIOD_SECONDS` since its `startTick`.
 */
export function lightPatchCentreAt(
  orbit: LightPatchOrbitView,
  tick: number,
  balance: { pool: Pick<BalanceConfig['pool'], 'POOL_LIGHT_PATCH_PERIOD_SECONDS'> },
): Vec2 {
  const turns = ticksToSeconds(tick - orbit.startTick) / balance.pool.POOL_LIGHT_PATCH_PERIOD_SECONDS;
  return pointOnCircle(orbit.orbitRadius, orbit.startAngleRadians + turns * RADIANS_PER_FULL_TURN);
}

/** A thread's centre lies midway between its ends. */
const THREAD_CENTRE_SHARE = 0.5;

/** A thread's two ends: `POOL_THREAD_LENGTH` apart along its angle, its centre midway; the band is `POOL_THREAD_WIDTH` wide. */
export function poolThreadEnds(
  thread: PoolThreadView,
  balance: { pool: Pick<BalanceConfig['pool'], 'POOL_THREAD_LENGTH'> },
): readonly [Vec2, Vec2] {
  const halfLength = pointOnCircle(balance.pool.POOL_THREAD_LENGTH * THREAD_CENTRE_SHARE, thread.angleRadians);
  return [
    { x: thread.x - halfLength.x, y: thread.y - halfLength.y },
    { x: thread.x + halfLength.x, y: thread.y + halfLength.y },
  ];
}

/** The bank's inner edge (phases.md §14.5.2): `DISH_RADIUS − POOL_BANK_WIDTH` from the pool's centre. */
export function poolBankInnerRadius(balance: {
  world: Pick<BalanceConfig['world'], 'DISH_RADIUS'>;
  pool: Pick<BalanceConfig['pool'], 'POOL_BANK_WIDTH'>;
}): number {
  return balance.world.DISH_RADIUS - balance.pool.POOL_BANK_WIDTH;
}
