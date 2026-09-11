// Snapshot encoding constants (docs/CODE-STANDARDS.md §2, docs/ARCHITECTURE.md §4.1). Engineering
// constants, not tunables: excluded from `data/balance.json`. The client-side netcode numbers
// (buffer size, interpolation delay, reconciliation) live here too.

/** Positions on the wire are rounded to this many decimals (0.1 wu): what keeps a snapshot under budget. */
export const SNAPSHOT_POSITION_DECIMALS = 1;

/**
 * Ticks between two `game_snapshot` broadcasts (docs/ARCHITECTURE.md §1): the one home of the
 * cadence, read by `GameRoom.runTick`. 1 today (every tick, 60 Hz); #214 raises it server-side.
 */
export const SNAPSHOT_EVERY_TICKS = 1;

// ---- client interpolation (docs/ARCHITECTURE.md §5, #99), derived from the cadence ----
/** Remote entities render this many snapshot intervals behind the newest snapshot. */
const INTERPOLATION_DELAY_INTERVALS = 2;
export const INTERPOLATION_DELAY_TICKS = INTERPOLATION_DELAY_INTERVALS * SNAPSHOT_EVERY_TICKS;
/** The buffer spans the delay plus one bracketing snapshot on each side. */
const BRACKET_SNAPSHOTS = 2;
/** Snapshots the client keeps for interpolation: 4 at either cadence. */
export const SNAPSHOT_BUFFER_SIZE = Math.ceil(INTERPOLATION_DELAY_TICKS / SNAPSHOT_EVERY_TICKS) + BRACKET_SNAPSHOTS;
/** A missing bracket extrapolates with velocity for at most this many ticks, then holds. */
export const MAX_EXTRAPOLATION_TICKS = 3;
/** The server-tick estimate's EMA weight per snapshot arrival: jitter averages out, drift is tracked. */
export const SERVER_TICK_ESTIMATE_SMOOTHING = 0.1;
