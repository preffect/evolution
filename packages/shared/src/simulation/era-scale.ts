// The move's scale (docs/game-design/phases.md §14.4.2, §14.6.3): a dish point `p` becomes pool point
// `p / ERA_SCALE_STEP`, so the dish's footprint in the pool is a disc of `DISH_RADIUS / ERA_SCALE_STEP`, and the landmark
// rotifer is drawn and collided at that radius. Read from the room's leaves, so a patched scale step or dish radius
// moves it. `constants/eras-derived.ts` calls this module while it loads (a constants → simulation edge,
// architecture/constants-files-tests.md §9), so it imports leaf constants modules only, never the constants barrel.

import type { BalanceConfig } from '../constants/balance.js';

/** What the footprint reads: the dish's radius and the scale step. */
export interface EraScaleBalance {
  world: Pick<BalanceConfig['world'], 'DISH_RADIUS'>;
  eras: Pick<BalanceConfig['eras'], 'ERA_SCALE_STEP'>;
}

/** The landmark rotifer's radius (wu, pool): the dish's footprint in the pool, `DISH_RADIUS / ERA_SCALE_STEP`. */
export function eraLandmarkRadius(balance: EraScaleBalance): number {
  return balance.world.DISH_RADIUS / balance.eras.ERA_SCALE_STEP;
}
