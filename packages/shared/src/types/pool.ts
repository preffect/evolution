// The rock pool's views (docs/architecture/entity-model.md §2, docs/game-design/phases.md §14.5, §14.6.4): its static
// layout, the surge and the copepod's pass, as the snapshot carries them. Apart from `game.ts`, which keeps the views
// every era shares; `messages.ts` and `effects.ts` import them from here. A view carries only what was drawn
// (positions, angles, ticks): every size (a film's radius, a thread's length and width, the light patch's radius, the
// bank's and the copepod lane's widths) is read from the live balance (docs/architecture/wire-contract.md §4 "The pool
// layout").
//
// The creatures (§14.6) are named here too: `PoolCreatureSpecies` and the view a creature's cell carries
// (`CellView.poolCreature`). Their shapes, the nematode's chain and the copepod's per-tick strip, are the shared
// formulas of `simulation/pool-creature-shapes.ts`.

import type { ValueOf } from './common.js';

/** A bacteria film on the rock pool's floor (docs/game-design/phases.md §14.5.2): a disc of `POOL_FILM_RADIUS` here. */
export interface PoolFilmView {
  x: number;
  y: number;
}

/**
 * An algal thread (phases.md §14.5.2): a band `POOL_THREAD_WIDTH` wide and `POOL_THREAD_LENGTH` long, centred here and
 * laid along `angleRadians` (`poolThreadEnds`).
 */
export interface PoolThreadView {
  x: number;
  y: number;
  angleRadians: number;
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

/**
 * The rock pool's creatures (docs/game-design/phases.md §14.6.1): the ciliate hunter, the anchored whirlpool, the
 * thrasher and the passing giant. Also the `debug_spawn` kinds and the `debug_get_entities` filters that name them
 * (docs/architecture/debug-mcp.md §8).
 */
export const POOL_CREATURE_SPECIES = {
  didinium: 'didinium',
  rotifer: 'rotifer',
  nematode: 'nematode',
  copepod: 'copepod',
} as const;
export type PoolCreatureSpecies = ValueOf<typeof POOL_CREATURE_SPECIES>;

/** The creatures that are cells. The copepod has no body: its pass is the snapshot's `CopepodLaneView` (§14.6.4). */
export type PoolCreatureCellSpecies = Exclude<PoolCreatureSpecies, typeof POOL_CREATURE_SPECIES.copepod>;

/** The creatures that kill without a killer cell (§14.6.4): a rotifer's swallow and the copepod's pass credit no one. */
export type CreditlessKillerSpecies = typeof POOL_CREATURE_SPECIES.rotifer | typeof POOL_CREATURE_SPECIES.copepod;

/**
 * What a creature's cell carries beside the ordinary cell fields (`CellView.poolCreature`, null for every other cell),
 * mirrored from its seat, the creature's whole memory (docs/architecture/entity-model.md §2).
 */
export interface PoolCreatureView {
  species: PoolCreatureCellSpecies;
  /**
   * The one rotifer at landmark size (§14.6.3): drawn and collided at `ERA_LANDMARK_RADIUS`, no pull, never eaten. The
   * shared movement step's rotifer pull skips it. False for every other creature.
   */
  isLandmark: boolean;
  /** The way the body lies (radians): the nematode's chain is laid along it (`nematodeSegmentCentres`). */
  headingRadians: number;
}
