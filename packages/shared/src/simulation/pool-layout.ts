// The rock pool's light patch (docs/game-design/phases.md §14.5.2, §14.5.3): its centre is a pure function of the tick
// and the layout's orbit, so it needs no field on the snapshot and the server, the shared movement step and the renderer
// read one place. Pure: the orbit was drawn once, from the `pool` stream, at the round's start.

import type { BalanceConfig } from '../constants/balance.js';
import { RADIANS_PER_FULL_TURN } from '../constants/units.js';
import { ticksToSeconds } from '../time/units.js';
import type { Vec2 } from '../types/common.js';
import type { LightPatchOrbitView } from '../types/pool.js';
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
