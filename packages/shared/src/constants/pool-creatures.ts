// The pool's creatures (docs/game-design/phases.md §14.6, its stage 1 constants table §14.14.1): the `poolCreatures`
// balance domain. Sizes are relative to a form arriving at `POOL_ARRIVAL_MASS` (§14.6.1); the landmark rotifer's
// numbers are the `eras` domain's (`ERA_LANDMARK_*`).

/** Didinium, the ciliate hunter: how many swim the pool. */
export const DIDINIUM_COUNT = 2;
export const DIDINIUM_MASS = 90;
/** wu/s. */
export const DIDINIUM_SPEED = 260;
/** Rotifers, the whirlpools, besides the landmark. */
export const ROTIFER_COUNT = 3;
export const ROTIFER_MASS = 480;
/** A rotifer's crown pulls what lies within this many of its own radii. */
export const ROTIFER_PULL_RANGE_RADII = 3;
/** The pull's added speed toward the rotifer (wu/s). */
export const ROTIFER_PULL_SPEED = 70;
/** A rotifer swallows at once any cell this heavy or lighter that touches it. */
export const ROTIFER_SWALLOW_MAX_MASS = 120;
/** Nematodes, the thrashers. */
export const NEMATODE_COUNT = 2;
/** A nematode's length along its wave (wu). */
export const NEMATODE_LENGTH = 320;
/** Its thickness (wu): each of its contact circles has half this as its radius (§14.6.4). */
export const NEMATODE_THICKNESS = 24;
/** The circles of its contact chain (§14.6.4). */
export const NEMATODE_SEGMENT_COUNT = 7;
/** wu/s. */
export const NEMATODE_SPEED = 180;
/** Touching a nematode knocks a cell aside at this speed (wu/s). */
export const NEMATODE_KNOCK_SPEED = 400;
/** The copepod, the passing giant: its length (wu); it has no body, only a lane (§14.6.4). */
export const COPEPOD_LENGTH = 1200;
/** wu/s along its lane. */
export const COPEPOD_SPEED = 600;
/** One pass per this many seconds. */
export const COPEPOD_PASS_INTERVAL_SECONDS = 50;
/** The first pass comes this long after the move (s). */
export const COPEPOD_FIRST_PASS_SECONDS = 60;
/** Its shadow and lane show this long before a pass (s, the `copepod_warning` effect). */
export const COPEPOD_WARNING_SECONDS = 3;
/** The lane's width (wu). */
export const COPEPOD_LANE_WIDTH = 500;
/** The copepod eats, whole, every cell and mote in its lane whose mass lies in [this, `COPEPOD_EATS_MAX_MASS`]. */
export const COPEPOD_EATS_MIN_MASS = 150;
export const COPEPOD_EATS_MAX_MASS = 1500;
/** A body of many cells in the window loses this many cells to a pass (§14.8.3). */
export const COPEPOD_BITE_CELLS = 4;
/** DNA a player gains for eating a Didinium or a rotifer, beside the ordinary payout. */
export const POOL_CREATURE_DNA_BONUS = 150;
/** An eaten Didinium or rotifer comes back after this long (s). */
export const POOL_CREATURE_RESPAWN_SECONDS = 90;
