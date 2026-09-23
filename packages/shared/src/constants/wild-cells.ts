// Wild cells (docs/ecology/wild-cells.md §3.3, docs/ecology/constants.md §7): the world's average made flesh. Their mass and ladder
// are pinned to the world clock every tick; these are the seats, the spread, the builds they
// climb and the behaviour knobs. The clock itself is world-clock.ts.

import { entityId, type EntityId } from '../types/common.js';
import { CELL_STAGE, type CellStage, type TraitId } from '../types/game.js';

/** Non-player cells in the dish from tick 0 to the end of the round; never varies with the stage. */
export const WILD_CELL_COUNT = 24;
/** massSpreadFactor ~ uniform[1 − this, 1 + this], drawn at each (re)spawn from the `wildCells` stream. */
export const WILD_CELL_MASS_SPREAD = 0.3;
/**
 * Three valid ladders (seat mod 3): a wild cell at level L owns the first L − 1 picks; the list
 * wraps as tier upgrades. Build 0 defines `worldStage` (docs/ecology/food-and-spawn.md §3.1).
 */
export const WILD_CELL_BUILDS: readonly (readonly TraitId[])[] = [
  [
    'nucleoid',
    'mitochondrion',
    'nuclear_envelope',
    'cytoskeleton',
    'amoeba_pseudopods',
    'ribosomes',
    'simple_flagellum',
  ],
  ['nucleoid', 'chloroplast', 'nuclear_envelope', 'cilia', 'paramecium_cilia', 'ribosomes', 'simple_flagellum'],
  ['nucleoid', 'mitochondrion', 'nuclear_envelope', 'cell_wall', 'diatom_shell', 'ribosomes', 'food_vacuole'],
];
/** Every wild cell's `organismId`, branded here once: wild never engulfs wild (docs/ecology/absorption.md §6.3, "same organism"). */
export const WORLD_ORGANISM_ID: EntityId = entityId('world');
/** A seat whose cell was absorbed or removed respawns after this (s). */
export const WILD_CELL_RESPAWN_SECONDS = 10;
/** Placement adds "no cell centre within this" (wu) to the safe-spawn rule. */
export const WILD_CELL_MIN_SPACING_WU = 200;
/** A seat decides (flee, hunt, wander) this often (s), staggered by seat number. */
export const WILD_CELL_DECISION_INTERVAL_SECONDS = 0.5;
/** Flee from a player that can engulf this cell within this many own radii. */
export const WILD_CELL_FLEE_RANGE_RADII = 8;
/** Hunt a player this cell can engulf within this many own radii. */
export const WILD_CELL_HUNT_RANGE_RADII = 10;
/** Wild cells hunt from this world stage on; before it they only wander and flee. */
export const WILD_CELL_HUNTS_FROM_STAGE: CellStage = CELL_STAGE.endosymbiosis;
/** Per wander decision: the chance of drawing a new heading instead of keeping the old one. */
export const WILD_CELL_TURN_CHANCE = 0.25;

// ===== Wild cells live their own lives (#517, design PRs #523 and #556) =====
// The design tables list these now; the build tickets #550, #551 and #558 wire them in and retire the
// per-tick pin constants above. Values are docs/ecology/constants.md §7's.

/** A newborn wild cell's size is drawn from [MIN, MAX] × the world's average mass. */
export const WILD_CELL_SIZE_FACTOR_MIN = 0.5;
export const WILD_CELL_SIZE_FACTOR_MAX = 2.0;
/** Time constant of a wild cell's recovery from a loss toward its full size, in seconds. */
export const WILD_CELL_RECOVERY_SECONDS = 6;
/** No wild cell grows past this multiple of the world's average mass. */
export const WILD_CELL_MAX_WORLD_MASS_MULTIPLE = 3;
/** A wild cell notices what a same-size player sees: this × `viewHalfHeightFor`. */
export const WILD_CELL_SIGHT_VIEW_MULTIPLE = 1.0;
/** A wild cell sprints to flee a threat within this many of its own radii. */
export const WILD_CELL_SPRINT_FLEE_RADII = 4;
/** A wild cell sprints to close on prey within this many of its own radii. */
export const WILD_CELL_SPRINT_HUNT_RADII = 3;
/** The dish feeds at most this × `WILD_CELL_COUNT` × the world's average mass in wild cells. */
export const WILD_CELL_CARRYING_CAPACITY_MULTIPLE = 1.5;
/** A starving wild cell loses this share of its full size per second. */
export const WILD_CELL_STARVATION_FRACTION_PER_SECOND = 0.1;
/** Wild cells hunt players from this stage on (they hunt each other from tick 0). */
export const WILD_CELL_HUNTS_PLAYERS_FROM_STAGE: CellStage = CELL_STAGE.endosymbiosis;
