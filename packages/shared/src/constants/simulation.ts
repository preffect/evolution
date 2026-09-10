// Engineering constants of the fixed-step loop (docs/CODE-STANDARDS.md §2, docs/ARCHITECTURE.md §3).
// Not gameplay tunables: excluded from `data/balance.json`. Snapshot and netcode constants
// join this file with the tickets that use them.

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
