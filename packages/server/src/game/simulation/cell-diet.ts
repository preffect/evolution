// What a non-player cell eats (docs/ecology/wild-cells.md §3.3.3, docs/ecology/giants.md §3.5.7): the mote kinds it
// targets and eats, whether it grazes what lies ahead first, and the growth it stops eating at. A wild cell eats algae
// and detritus, always (bacteria are the players'); a giant by its species' role: the grazer algae, detritus and
// bacteria, ahead of it first, only while its growth is under `GIANT_GRAZER_APPETITE_MASS`; the hunter and the drifter
// nothing. No cell but a player's eats a DNA fragment. Step 4 (`eating.ts`) and the seat's decision
// (`wild/seat-profile.ts`) both read it, so the mote a cell steers to is the one it can eat. Pure over the balance.

import {
  FOOD_KIND,
  GIANT_ROLE,
  GIANT_ROLE_BY_SPECIES,
  type BalanceConfig,
  type FoodKind,
  type GiantSpecies,
} from '@evolution/shared';
import type { CellRecord } from '../world/entities.js';
import type { WorldState } from '../world/world-state.js';

export interface CellDiet {
  /** The mote kinds it targets and eats. */
  readonly foodKinds: readonly FoodKind[];
  /** The half-angle (°) either side of ahead it grazes first; `null` for the nearest mote anywhere in sight. */
  readonly forwardHalfAngleDegrees: number | null;
  /** It targets and eats food only while its growth is under this mass. */
  readonly appetiteMass: number;
}

const NO_FOOD: readonly FoodKind[] = [];
const WILD_FOOD_KINDS: readonly FoodKind[] = [FOOD_KIND.algae, FOOD_KIND.detritus];
const GRAZER_FOOD_KINDS: readonly FoodKind[] = [FOOD_KIND.algae, FOOD_KIND.detritus, FOOD_KIND.bacterium];
const ANYWHERE_IN_SIGHT = null;
const NEVER_SATED = Number.POSITIVE_INFINITY;

/** A wild cell's diet: algae and detritus, the nearest in sight, always hungry. */
export const WILD_CELL_DIET: CellDiet = {
  foodKinds: WILD_FOOD_KINDS,
  forwardHalfAngleDegrees: ANYWHERE_IN_SIGHT,
  appetiteMass: NEVER_SATED,
};

/** The hunter's and the drifter's: nothing. */
const NOTHING_DIET: CellDiet = { foodKinds: NO_FOOD, forwardHalfAngleDegrees: ANYWHERE_IN_SIGHT, appetiteMass: 0 };

/** A giant's diet by its species' role (giants.md §3.5.7). */
export function giantDiet(species: GiantSpecies, balance: BalanceConfig): CellDiet {
  if (GIANT_ROLE_BY_SPECIES[species] !== GIANT_ROLE.grazer) {
    return NOTHING_DIET;
  }
  return {
    foodKinds: GRAZER_FOOD_KINDS,
    forwardHalfAngleDegrees: balance.giants.GIANT_GRAZER_FORWARD_HALF_ANGLE_DEGREES,
    appetiteMass: balance.giants.GIANT_GRAZER_APPETITE_MASS,
  };
}

/** Whether a cell on `diet` with `grownMass` of growth still eats: its growth is under its appetite. */
export function isHungry(diet: CellDiet, grownMass: number): boolean {
  return grownMass < diet.appetiteMass;
}

/** The kinds `diet` eats at `grownMass`: none once sated. */
export function mealKindsAt(diet: CellDiet, grownMass: number): readonly FoodKind[] {
  return isHungry(diet, grownMass) ? diet.foodKinds : NO_FOOD;
}

/**
 * The mote kinds a non-player cell eats this tick (step 4): a wild cell's always, a giant's from its seat's growth.
 * The test is made once per cell before its meal, so one tick's meal may overshoot the appetite by a few motes.
 */
export function mealKindsOf(world: WorldState, cell: CellRecord, balance: BalanceConfig): readonly FoodKind[] {
  if (cell.giantSpecies === null) {
    return WILD_CELL_DIET.foodKinds;
  }
  const seat = world.giantSeats.find((candidate) => candidate.cellId === cell.id);
  return seat === undefined ? NO_FOOD : mealKindsAt(giantDiet(cell.giantSpecies, balance), seat.grownMass);
}
