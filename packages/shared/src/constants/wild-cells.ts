// Wild cells (docs/ECOLOGY.md §3.3, §7): the world's average made flesh. Their mass and ladder
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
 * wraps as tier upgrades. Build 0 defines `worldStage` (docs/ECOLOGY.md §3.1).
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
/** Every wild cell's `organismId`, branded here once: wild never engulfs wild (docs/ECOLOGY.md §6.3, "same organism"). */
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
