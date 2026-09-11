// Snapshot encoding constants (docs/CODE-STANDARDS.md §2, docs/ARCHITECTURE.md §4.1). Engineering
// constants, not tunables: excluded from `data/balance.json`. The client-side netcode numbers
// (buffer size, interpolation delay, reconciliation) live here too.

/** Positions on the wire are rounded to this many decimals (0.1 wu): what keeps a snapshot under budget. */
export const SNAPSHOT_POSITION_DECIMALS = 1;

// ---- client interpolation (docs/ARCHITECTURE.md §5, #99) ----
/** Snapshots the client keeps for interpolation. */
export const SNAPSHOT_BUFFER_SIZE = 4;
/** Remote entities render this many ticks behind the newest snapshot: two snapshot intervals. */
export const INTERPOLATION_DELAY_TICKS = 6;
/** A missing bracket extrapolates with velocity for at most this many ticks, then holds. */
export const MAX_EXTRAPOLATION_TICKS = 3;
/** The server-tick estimate's EMA weight per snapshot arrival: jitter averages out, drift is tracked. */
export const SERVER_TICK_ESTIMATE_SMOOTHING = 0.1;
