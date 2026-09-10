// Steering and sprint (docs/GAME-DESIGN.md §6, §12). The per-tick steer blend is derived in
// code from `CELL_ACCELERATION_SECONDS` (growth.ts), never declared here.

/** Pointer inside this many radii of the centre: throttle 0. */
export const STEER_DEAD_ZONE_RADII = 0.5;
/** Pointer beyond this many radii: throttle 1. */
export const STEER_FULL_THROTTLE_RADII = 2.0;
/** Max speed while sprinting. */
export const SPRINT_SPEED_MULTIPLIER = 1.8;
/** Sprint length (s). */
export const SPRINT_DURATION_SECONDS = 0.5;
/** From sprint start to the next allowed sprint (s). */
export const SPRINT_COOLDOWN_SECONDS = 3;
/** Of current mass, floored at the starting mass. */
export const SPRINT_MASS_COST_FRACTION = 0.05;
