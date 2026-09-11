// The world clock (docs/GAME-DESIGN.md §5.5, §12; docs/ECOLOGY.md §3.1): round time turned into
// the world's average cell. The formulas have one home, simulation/world-clock.ts.

/** Seconds per world level: worldLevel = min(1 + elapsedSeconds / this, MAX_LEVEL). */
export const WORLD_LEVEL_SECONDS = 180;
/** Mass per second: worldMass = min(CELL_STARTING_MASS + this × elapsedSeconds, CELL_MAX_MASS). */
export const WORLD_MASS_GAIN_PER_SECOND = 1;
/** Band either side of `worldMass` (as a ratio of it) that reads as `with` the world at equal level. */
export const WORLD_STANDING_MASS_TOLERANCE = 0.1;
