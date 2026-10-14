// The rock pool, the second world (docs/game-design/phases.md §14.5, its stage 1 constants table §14.14.1): the `pool`
// balance domain. The arena keeps `DISH_RADIUS` (decided, §14.5.2), so there is no pool radius here.

/** Every player arrives in the pool at this mass, whatever its form (§14.3). */
export const POOL_ARRIVAL_MASS = 60;
/** A player entering the pool later (a late join or a respawn) enters at most this heavy (§14.7.3). */
export const POOL_ENTRY_MAX_MASS = 400;
/** The world mass restarts here at the move (§14.2.2). */
export const POOL_WORLD_MASS_START = 60;
/** Then grows by this per second since the move (mass/s). */
export const POOL_WORLD_MASS_GAIN_PER_SECOND = 0.5;
/** The mass of one green speck, the pool's main food (the `green_speck` mote kind). */
export const POOL_GREEN_SPECK_MASS = 3;
/** Green specks per swarm. */
export const POOL_SWARM_SIZE = 12;
/** Swarms the field holds; a swarm respawns at a random point when eaten down to a quarter. */
export const POOL_SWARM_COUNT = 10;
/** A swarm drifts toward the light patch at this speed (wu/s). */
export const POOL_SWARM_SPEED = 30;
/** The light patch, the pool's `sunlit_shallows` zone, is a disc of this radius (wu). */
export const POOL_LIGHT_PATCH_RADIUS = 900;
/** The light patch circles the pool once per this many seconds. */
export const POOL_LIGHT_PATCH_PERIOD_SECONDS = 240;
/** Bacteria films on the pool's floor, fixed per game. */
export const POOL_FILM_COUNT = 5;
/** Each film is a disc of this radius (wu). */
export const POOL_FILM_RADIUS = 350;
/** A cell moving at under half its top speed over a film gains this (mass/s). */
export const POOL_FILM_GRAZE_MASS_PER_SECOND = 2;
/** Algal threads (cover bands), fixed per game. */
export const POOL_THREAD_COUNT = 6;
/** Each thread's length (wu). */
export const POOL_THREAD_LENGTH = 1400;
/** Each thread's width (wu). */
export const POOL_THREAD_WIDTH = 60;
/** A cell inside a thread is hidden from hunters only at this mass or lighter. */
export const POOL_THREAD_COVER_MAX_MASS = 300;
/** A hidden cell moves at this fraction of its speed. */
export const POOL_THREAD_SPEED_FACTOR = 0.7;
/** A surge washes over the pool once per this many seconds. */
export const POOL_SURGE_PERIOD_SECONDS = 45;
/** Each surge lasts this long (s). */
export const POOL_SURGE_SECONDS = 4;
/** Its ripples cross the view this long before it starts (s, the `surge_warning` effect). */
export const POOL_SURGE_WARNING_SECONDS = 3;
/** The surge adds this speed along its direction to every cell and mote (wu/s). */
export const POOL_SURGE_SPEED = 90;
/** The bank, the wet rock inside the pool's wall, is a band this wide (wu). */
export const POOL_BANK_WIDTH = 250;
