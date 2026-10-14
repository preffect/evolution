// The eras and the move between them (docs/game-design/phases.md §14.2, §14.4, its stage 1 constants table §14.14.1):
// the `eras` balance domain. The era is derived from the round clock by `eraAt` (simulation/era-clock.ts); nothing
// here is read outside a room's balance. Pool-world units (`wu (pool)`) are dish units divided by `ERA_SCALE_STEP`.
// The landmark's radius is derived from the scale step (`eras-derived.ts`), so it is no leaf here.

import { GAME_ERA, type GameEra } from '../types/game.js';

/** Each era's start in game time (s after `roundStartTick`): the dish at 0, the pool at 10:00, the colonies at 17:00. */
export const ERA_START_SECONDS: Readonly<Record<GameEra, number>> = {
  [GAME_ERA.dish]: 0,
  [GAME_ERA.pool]: 600,
  [GAME_ERA.colonies]: 1020,
};
/**
 * The eras a game may reach, a non-empty prefix of `GAME_ERA_ORDER` (phases.md §14.2.4). Ships as the dish alone
 * (today's game); each "on" slice lengthens it. Patchable to any other prefix, never to another list.
 */
export const ERAS_IN_PLAY: readonly GameEra[] = [GAME_ERA.dish];
/** The size step of the move: a dish point `p` becomes pool point `p / this` (phases.md §14.4.2). */
export const ERA_SCALE_STEP = 10;
/** The move's warning comes this long before it (s): the toast, the thinning rim, the pool's layout on the wire. */
export const ERA_MOVE_WARNING_SECONDS = 10;
/** After the move nothing targets a player and no engulf of a player cell starts for this long (s). */
export const ERA_MOVE_GRACE_SECONDS = 8;
/** Nothing hostile and no swarm is placed within this of the pool's centre on the move tick (wu, pool), but the landmark. */
export const ERA_LANDING_CLEAR_RADIUS = 900;
/** The landmark rotifer's anchor lies this far due east or due west of the pool's centre (wu, pool). */
export const ERA_LANDMARK_DISTANCE = 650;
/** Each dish wild cell and giant becomes one green speck of this mass at its mapped point. */
export const ERA_LEFTOVER_SPECK_MASS = 2;
/** After the move the shared camera eases its zoom toward the pool's view for this long (s, §14.4.4). */
export const ERA_MOVE_CAMERA_EASE_SECONDS = 4;
/** The zoom's smoothing time constant during that ease (s), in place of `CAMERA_ZOOM_SECONDS`. */
export const ERA_MOVE_CAMERA_ZOOM_SECONDS = 1.0;
