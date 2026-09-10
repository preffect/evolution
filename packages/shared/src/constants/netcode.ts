// Client netcode engineering constants (docs/ARCHITECTURE.md §5, docs/CODE-STANDARDS.md §2).
// Not gameplay tunables: excluded from `data/balance.json`.

/** Snapshots the client keeps for interpolation. */
export const SNAPSHOT_BUFFER_SIZE = 4;
/** Remote entities render this many ticks behind the newest snapshot: two snapshot intervals. */
export const INTERPOLATION_DELAY_TICKS = 6;
/** A missing bracket extrapolates with velocity for at most this many ticks, then holds. */
export const MAX_EXTRAPOLATION_TICKS = 3;
