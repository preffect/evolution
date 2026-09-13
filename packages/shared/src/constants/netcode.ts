// Snapshot encoding constants (docs/CODE-STANDARDS.md §2, docs/ARCHITECTURE.md §4.1). Engineering
// constants, not tunables: excluded from `data/balance.json`. The client-side netcode numbers
// (buffer size, interpolation delay, reconciliation) live here too.

import { BYTES_PER_KIBIBYTE } from './units.js';
import { TICK_HZ } from './network.js';

/** Positions on the wire are rounded to this many decimals (0.1 wu): what keeps a snapshot under budget. */
export const SNAPSHOT_POSITION_DECIMALS = 1;

/**
 * Ticks between two `game_snapshot` broadcasts (docs/ARCHITECTURE.md §1): the one home of the
 * cadence, read by `GameRoom.runTick`. 1 today (every tick, 60 Hz); #214 raises it server-side.
 */
export const SNAPSHOT_EVERY_TICKS = 1;

/** What a room may push to one client (docs/ARCHITECTURE.md §4.1): the raw per-client wire budget. */
const CLIENT_WIRE_BUDGET_BYTES_PER_SECOND = 500 * BYTES_PER_KIBIBYTE;
/** How far behind the room's own stream a client may fall before it is skipped. */
const SNAPSHOT_BACKLOG_LIMIT_SECONDS = 1;

/**
 * Ticks of snapshots that may be in flight to one client before the room stops adding to them
 * (#266, docs/ARCHITECTURE.md §4): the client acknowledges the newest tick it has applied, and the
 * difference from the newest tick the room sent it is the depth of the queue between them —
 * wherever that queue actually sits (the room's socket, a dev proxy, the kernel, the browser).
 * A healthy client's depth is the ack cadence plus the round trip, a few ticks; a second of it
 * means the client is not keeping up and more snapshots would only make it staler.
 */
export const SNAPSHOT_BACKLOG_LIMIT_TICKS = TICK_HZ * SNAPSHOT_BACKLOG_LIMIT_SECONDS;

/**
 * Snapshots a client applies between two acknowledgements: often enough that the measured depth is
 * mostly the real queue and not the cadence, rare enough that the upstream cost stays negligible.
 */
export const SNAPSHOT_ACK_EVERY_SNAPSHOTS = 5;

/**
 * Unsent bytes on a connection at which the room stops queueing deltas for it (#266,
 * docs/ARCHITECTURE.md §4). A client that cannot drain the cadence would otherwise be queued every
 * snapshot the room ever sent it, so its view falls behind for good and the server holds the
 * backlog. Above the limit the connection is sent nothing; when it drains it is sent one
 * `game_state` in place of the next delta, and is current again.
 */
export const SNAPSHOT_BACKLOG_LIMIT_BYTES = CLIENT_WIRE_BUDGET_BYTES_PER_SECOND * SNAPSHOT_BACKLOG_LIMIT_SECONDS;

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
