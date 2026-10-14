// The rock pool's views (docs/architecture/entity-model.md §2, docs/game-design/phases.md §14.5, §14.6.4): its static
// layout, the surge and the copepod's pass, as the snapshot carries them. Apart from `game.ts`, which keeps the views
// every era shares; `messages.ts` and `effects.ts` import them from here.

/** A bacteria film on the rock pool's floor (docs/game-design/phases.md §14.5.2): a disc, fixed for the game. */
export interface PoolFilmView {
  x: number;
  y: number;
  radius: number;
}

/** An algal thread (phases.md §14.5.2): a band `width` wide along the segment from its start to its end. */
export interface PoolThreadView {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  width: number;
}

/**
 * The light patch's orbit round the pool's centre (phases.md §14.5.2): on `startTick` its centre lies `orbitRadius`
 * from the centre at `startAngleRadians`, and it turns counter-clockwise once per `POOL_LIGHT_PATCH_PERIOD_SECONDS`
 * (`lightPatchCentreAt`). The patch's own radius is the balance's `POOL_LIGHT_PATCH_RADIUS`.
 */
export interface LightPatchOrbitView {
  orbitRadius: number;
  startAngleRadians: number;
  startTick: number;
}

/**
 * The rock pool's static layer (phases.md §14.4.6, §14.5.2): drawn from the `pool` stream at the round's start when the
 * pool is in play, on the snapshot from the pool's warning tick on (docs/architecture/wire-contract.md §4 "The pool
 * layout"). The bank needs no field: it is the band `POOL_BANK_WIDTH` wide inside the wall.
 */
export interface PoolLayoutView {
  films: PoolFilmView[];
  threads: PoolThreadView[];
  lightPatchOrbit: LightPatchOrbitView;
}

/**
 * A surge (phases.md §14.5.2, §14.5.3): from `startedAtTick` for `POOL_SURGE_SECONDS` every cell and mote but the
 * anchored is pushed along the unit direction at `POOL_SURGE_SPEED`. On the snapshot from the tick its warning starts
 * (`POOL_SURGE_WARNING_SECONDS` before `startedAtTick`) until it ends, so the shared movement step predicts it.
 */
export interface SurgeView {
  startedAtTick: number;
  directionX: number;
  directionY: number;
}

/**
 * The copepod's pass (phases.md §14.6.1, §14.6.4): it has no body. Its head is at the start point on `startedAtTick` and
 * runs along the unit direction at `COPEPOD_SPEED`, sweeping a lane `COPEPOD_LANE_WIDTH` wide. On the snapshot from the
 * tick its warning starts (`COPEPOD_WARNING_SECONDS` before `startedAtTick`) until the pass ends.
 */
export interface CopepodLaneView {
  startX: number;
  startY: number;
  directionX: number;
  directionY: number;
  startedAtTick: number;
}
