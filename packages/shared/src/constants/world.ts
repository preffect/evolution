// The petri dish and spawn safety (docs/GAME-DESIGN.md §8, §5.2, §12).

/** The world is the disc of this radius (wu), centred at the origin. */
export const DISH_RADIUS = 3000;
/** No food spawns nearer than this to the wall (wu). */
export const FOOD_EDGE_MARGIN = 40;
/** No cell spawns nearer than this to the wall (wu). */
export const SPAWN_EDGE_MARGIN = 300;
/** Threat-free radius required around a spawn point (wu). */
export const SAFE_SPAWN_RADIUS = 600;
/** A threat is a cell of at least this times the starting mass. */
export const SAFE_SPAWN_THREAT_MASS_RATIO = 2;
/** Candidate draws before the farthest-from-threat candidate is taken. */
export const SAFE_SPAWN_MAX_ATTEMPTS = 20;
