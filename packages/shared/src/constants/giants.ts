// Giant cells (docs/ecology/giants.md §3.5, docs/ecology/constants.md §7): three wild cells with a species, a born mass
// that never moves with the world, a fixed build and a role. The records are keyed by `GiantSpecies`. Every export is a
// balance leaf of the `giants` domain except `GIANT_ROLE_BY_SPECIES`: a role is what a species is, `canEngulf` reads it
// (`simulation/engulf-eligibility.ts`), and no patch may change it, so balance.ts leaves it out of the domain.

import { GIANT_ROLE, GIANT_SPECIES, type GiantRole, type GiantSpecies, type OwnedTrait } from '../types/game.js';

/**
 * The species seated at world creation, one seat each (giants.md §3.5.9). Empty until the giants-on slice (giants.md
 * §3.5.17), so the human's game holds no giant before its mind, art and names land; a test balance sets it.
 */
export const GIANT_SPECIES_IN_DISH: readonly GiantSpecies[] = [];
/** The role of each species (giants.md §3.5.6): the hunter alone eats cells. Not a balance leaf. */
export const GIANT_ROLE_BY_SPECIES: Readonly<Record<GiantSpecies, GiantRole>> = {
  [GIANT_SPECIES.amoeba]: GIANT_ROLE.hunter,
  [GIANT_SPECIES.paramecium]: GIANT_ROLE.grazer,
  [GIANT_SPECIES.diatom]: GIANT_ROLE.drifter,
};
/** A giant's born mass is uniform on [min, max), drawn once per life (giants.md §3.5.3). */
export const GIANT_BORN_MASS_MIN_BY_SPECIES: Record<GiantSpecies, number> = {
  [GIANT_SPECIES.amoeba]: 900,
  [GIANT_SPECIES.paramecium]: 900,
  [GIANT_SPECIES.diatom]: 1000,
};
export const GIANT_BORN_MASS_MAX_BY_SPECIES: Record<GiantSpecies, number> = {
  [GIANT_SPECIES.amoeba]: 1500,
  [GIANT_SPECIES.paramecium]: 1300,
  [GIANT_SPECIES.diatom]: 1500,
};
/** A giant never grows past this mass, so a player outgrows every giant (giants.md §3.5.3). */
export const GIANT_MASS_CEILING = 1500;
/** A giant's growth decays at the player's rate × this: a meal lasts (giants.md §3.5.3). */
export const GIANT_DECAY_MULTIPLIER = 0.25;
/**
 * Each species' fixed build (giants.md §3.5.4): a valid ladder ending in its form, owned at these tiers for its whole
 * life. Its level is derived from it (picks + 1), never named.
 */
export const GIANT_BUILDS_BY_SPECIES: Record<GiantSpecies, readonly OwnedTrait[]> = {
  [GIANT_SPECIES.amoeba]: [
    { traitId: 'nucleoid', tier: 1 },
    { traitId: 'mitochondrion', tier: 1 },
    { traitId: 'nuclear_envelope', tier: 1 },
    { traitId: 'cytoskeleton', tier: 1 },
    { traitId: 'amoeba_pseudopods', tier: 2 },
  ],
  [GIANT_SPECIES.paramecium]: [
    { traitId: 'nucleoid', tier: 1 },
    { traitId: 'mitochondrion', tier: 1 },
    { traitId: 'nuclear_envelope', tier: 1 },
    { traitId: 'cilia', tier: 1 },
    { traitId: 'paramecium_cilia', tier: 1 },
  ],
  [GIANT_SPECIES.diatom]: [
    { traitId: 'nucleoid', tier: 1 },
    { traitId: 'chloroplast', tier: 1 },
    { traitId: 'nuclear_envelope', tier: 1 },
    { traitId: 'cell_wall', tier: 1 },
    { traitId: 'diatom_shell', tier: 1 },
  ],
};
/** × the folded speed of the build (giants.md §3.5.5): slow, fast, slowest; never above 1. */
export const GIANT_SPEED_MULTIPLIER_BY_SPECIES: Record<GiantSpecies, number> = {
  [GIANT_SPECIES.amoeba]: 0.7,
  [GIANT_SPECIES.paramecium]: 0.85,
  [GIANT_SPECIES.diatom]: 0.6,
};
/** Per wander decision, the chance of a new heading (giants.md §3.5.5): wander, sweep, drift. */
export const GIANT_TURN_CHANCE_BY_SPECIES: Record<GiantSpecies, number> = {
  [GIANT_SPECIES.amoeba]: 0.25,
  [GIANT_SPECIES.paramecium]: 0.1,
  [GIANT_SPECIES.diatom]: 0.05,
};
/** The hunt window (giants.md §3.5.6): the hunter picks prey of at least this × its mass. Gates the chase, never the swallow. */
export const GIANT_HUNT_MIN_PREY_MASS_FRACTION = 0.25;
/** A giant gives up a hunt that started no engulf after this long (s): it is slow (giants.md §3.5.6). */
export const GIANT_HUNT_GIVE_UP_SECONDS = 8;
/** The grazer eats food within this many degrees either side of ahead (giants.md §3.5.7). */
export const GIANT_GRAZER_FORWARD_HALF_ANGLE_DEGREES = 60;
/** The grazer eats while its growth is under this mass (giants.md §3.5.7). */
export const GIANT_GRAZER_APPETITE_MASS = 100;
/** The DNA a player gains for eating a giant, through its gain multiplier (giants.md §3.5.8). */
export const GIANT_DNA_BONUS = 200;
/** A giant seat respawns this long (s) after its cell is absorbed or removed (giants.md §3.5.8). */
export const GIANT_RESPAWN_SECONDS = 90;
/** A giant is placed at least this far (wu) from every player cell (giants.md §3.5.9). */
export const GIANT_MIN_PLAYER_DISTANCE_WU = 1500;
/** … from every other giant (wu). */
export const GIANT_MIN_GIANT_DISTANCE_WU = 1500;
/** … and from every other cell (wu). */
export const GIANT_MIN_CELL_DISTANCE_WU = 450;
