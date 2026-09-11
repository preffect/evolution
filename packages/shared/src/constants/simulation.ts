// Engineering constants of the fixed-step loop and the simulation's data structures
// (docs/CODE-STANDARDS.md §2, docs/ARCHITECTURE.md §3). Not gameplay tunables: excluded from
// `data/balance.json`. Netcode constants (snapshot encoding) live in netcode.ts.

/**
 * Cap on simulation steps run for one ticker fire. After a stall the accumulator would owe
 * many ticks; running them all would stall again (spiral of death), so the surplus is dropped
 * and reported through `PerfTracker`, never silently (docs/DETERMINISM.md §2).
 */
export const MAX_TICKS_PER_ADVANCE = 5;

/**
 * Tolerance, in ticks, added before flooring the accumulator's due-tick count. The tick
 * interval is fractional (16.67 ms) and `n × TICK_INTERVAL_MS / TICK_INTERVAL_MS` can land a
 * few ULPs under `n`; without this a clock advanced by exactly one interval could owe zero ticks.
 */
export const FIXED_STEP_ROUNDING_TOLERANCE_TICKS = 1e-9;

/**
 * The same tolerance for the spawners' fractional accumulators (docs/ECOLOGY.md §3): 600
 * additions of `0.4 / 60` land a few ULPs under 4, and the fourth fragment of E2 would spawn a
 * tick late without it.
 */
export const SPAWN_ACCUMULATOR_TOLERANCE = 1e-9;

/**
 * Side of the uniform grid the spatial hash buckets entities in (wu). Larger than the widest
 * eating query (a 5000-mass cell is 283 wu across plus a mote radius), so a circle query touches
 * at most nine buckets.
 */
export const SPATIAL_HASH_CELL_SIZE_WU = 300;

/** Point redraws before a gel patch placement is declared impossible (an invariant, never a skip). */
export const GEL_PATCH_PLACEMENT_MAX_ATTEMPTS = 100;

/**
 * The initial fill never skips a spawn (docs/ECOLOGY.md §3): a rejected point is redrawn until
 * accepted. This bounds the redraw so a dish full of cells surfaces as an invariant error rather
 * than a hang.
 */
export const INITIAL_FILL_POINT_MAX_ATTEMPTS = 1000;

/** Bumped when the module's replay record changes shape (docs/DETERMINISM.md §6). */
export const REPLAY_FORMAT_VERSION = 1;
