// Snapshot encoding constants (docs/CODE-STANDARDS.md §2, docs/ARCHITECTURE.md §4.1). Engineering
// constants, not tunables: excluded from `data/balance.json`. The client-side netcode numbers
// (buffer size, interpolation delay, reconciliation) join this file with the client tickets.

/** Positions on the wire are rounded to this many decimals (0.1 wu): what keeps a snapshot under budget. */
export const SNAPSHOT_POSITION_DECIMALS = 1;
