// Size, mass, speed and the growth cap (docs/ECOLOGY.md §4, §5, §7).

/** Mass of a fresh cell; decay and drains never go below it. */
export const CELL_STARTING_MASS = 20;
/** Mass beyond this converts to DNA (docs/ECOLOGY.md §5.4). */
export const CELL_MAX_MASS = 5000;
/** radius = CELL_RADIUS_SCALE × sqrt(mass) (wu per √mass). */
export const CELL_RADIUS_SCALE = 4;
/** Speed curve bounds (wu/s). */
export const CELL_BASE_SPEED = 220;
export const CELL_MIN_SPEED = 50;
/** maxSpeed = CELL_BASE_SPEED × (CELL_STARTING_MASS / mass) ^ this. */
export const CELL_SPEED_MASS_EXPONENT = 0.25;
/** Steer blend time constant (s); the per-tick blend is derived in the movement kernel. */
export const CELL_ACCELERATION_SECONDS = 0.25;
/** Overlapping cells that cannot engulf each other separate by this share of the overlap per tick. */
export const CELL_SEPARATION_FRACTION_PER_TICK = 0.2;
/** gelSpeedFactor(mass) = clamp(1 − mass / GEL_MASS_SCALE, GEL_MIN_SPEED_FACTOR, GEL_MAX_SPEED_FACTOR). */
export const GEL_MASS_SCALE = 1000;
export const GEL_MIN_SPEED_FACTOR = 0.4;
export const GEL_MAX_SPEED_FACTOR = 0.9;
/** DNA per unit of mass gained at the cap. */
export const MASS_OVERFLOW_DNA_PER_MASS = 0.1;

// Mitosis, merge-back and eject are build 2 (docs/ECOLOGY.md §5.4, #28): declared so the
// contract is stable, unused by the build-1 simulation.
export const MITOSIS_MIN_MASS = 200;
export const MITOSIS_MAX_CELLS = 4;
export const MITOSIS_COOLDOWN_SECONDS = 8;
export const MITOSIS_MERGE_SECONDS = 20;
export const EJECT_MASS = 10;
