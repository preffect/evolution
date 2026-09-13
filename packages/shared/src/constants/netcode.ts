// Snapshot encoding constants (docs/CODE-STANDARDS.md §2, docs/ARCHITECTURE.md §4.1). Engineering
// constants, not tunables: excluded from `data/balance.json`. The client-side netcode numbers
// (buffer size, interpolation delay, reconciliation) live here too.

import { BYTES_PER_KIBIBYTE } from './units.js';
import { TICK_HZ } from './network.js';

/** Positions on the wire are rounded to this many decimals (0.1 wu): what keeps a snapshot under budget. */
export const SNAPSHOT_POSITION_DECIMALS = 1;

/**
 * Ticks between two `game_snapshot` broadcasts (docs/ARCHITECTURE.md §1): the one home of the
 * cadence, read by `GameRoom.runTick`. 3 at `TICK_HZ` = 60, so the wire runs at 20 Hz — a third
 * of the bytes the room sent while it broadcast every tick, which is what §4.1 budgets (#214).
 */
export const SNAPSHOT_EVERY_TICKS = 3;

/**
 * What a room may push to one client (docs/ARCHITECTURE.md §4.1): the *budgeted* per-client wire,
 * which assumes §4.2 lever 1 (viewport culling, #171). The uncut contract is about 800 KB/s at the
 * 20 Hz cadence, so the byte limit below is nearer two thirds of a second of today's worst-case
 * traffic than the whole second it names; it becomes a true second once lever 1 lands.
 */
const CLIENT_WIRE_BUDGET_BYTES_PER_SECOND = 500 * BYTES_PER_KIBIBYTE;
/** How far behind the room's own stream a client may fall before it is skipped. */
const SNAPSHOT_BACKLOG_LIMIT_SECONDS = 1;

/**
 * Ticks of snapshots that may be in flight to one client before the room stops adding to them
 * (#266, docs/ARCHITECTURE.md §4): the client acknowledges the newest tick it has applied, and the
 * difference from the newest tick the room sent it is the depth of the queue between them —
 * wherever that queue actually sits (the room's socket, a dev proxy, the kernel, the browser).
 * A healthy client's depth is the ack cadence plus the round trip — 6 ticks of cadence at 60 and
 * 20 Hz, by the derivation below, and never more than `SNAPSHOT_ACK_INTERVAL_MS` of it at any
 * cadence; a second of it means the client is not keeping up and more snapshots would only make it
 * staler. The check runs on broadcast ticks, so the depth overshoots this by up to one
 * `SNAPSHOT_EVERY_TICKS` before the room acts (63 against 60 today, pinned in
 * `game-room-cadence.test.ts`).
 */
export const SNAPSHOT_BACKLOG_LIMIT_TICKS = TICK_HZ * SNAPSHOT_BACKLOG_LIMIT_SECONDS;

/** Most acknowledgements a client sends per second: the duration below, as a rate. */
const ACK_INTERVALS_PER_SECOND = 10;

/**
 * How long a client may go between acknowledgements, as a tick budget rather than a count of
 * snapshots (#277). `SNAPSHOT_BACKLOG_LIMIT_TICKS` is a second of ticks, so a cadence counted in
 * snapshots would move the floor of that measurement every time `SNAPSHOT_EVERY_TICKS` moved and one
 * lever would eat the other's headroom: a fixed 5 snapshots is 5 ticks at 60 Hz, 15 at 20 Hz and 20
 * at 15 Hz, all against the same 60-tick limit. Derived, it is 6, 6 and 4. Ticks and not
 * milliseconds so the division below is exact integer arithmetic at every cadence.
 */
export const SNAPSHOT_ACK_INTERVAL_TICKS = TICK_HZ / ACK_INTERVALS_PER_SECOND;

/**
 * The budget above in snapshots, which is what the client can count. Rounded **down**, so the
 * acknowledgement never falls further apart than the budget at a cadence that does not divide it
 * (at 15 Hz, rounding up would be 8 ticks against a budget of 6); at least one, for a cadence
 * slower than the budget itself.
 */
export const SNAPSHOT_ACK_EVERY_SNAPSHOTS = Math.max(1, Math.floor(SNAPSHOT_ACK_INTERVAL_TICKS / SNAPSHOT_EVERY_TICKS));

/** What the derivation guarantees: the acknowledgement gap in ticks, whatever the cadence. */
export const SNAPSHOT_ACK_EVERY_TICKS = SNAPSHOT_ACK_EVERY_SNAPSHOTS * SNAPSHOT_EVERY_TICKS;

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
/** Snapshots the client keeps for interpolation: the delay plus a bracket each side, 4 today. */
export const SNAPSHOT_BUFFER_SIZE = Math.ceil(INTERPOLATION_DELAY_TICKS / SNAPSHOT_EVERY_TICKS) + BRACKET_SNAPSHOTS;
/** A missing bracket extrapolates with velocity for at most this many ticks, then holds. */
export const MAX_EXTRAPOLATION_TICKS = 3;
/** The server-tick estimate's EMA weight per snapshot arrival: jitter averages out, drift is tracked. */
export const SERVER_TICK_ESTIMATE_SMOOTHING = 0.1;

/**
 * Ticks a client has to draw a frame in for an effect to fire (docs/ARCHITECTURE.md §5). An effect at
 * tick `T` becomes due when the render tick reaches it, with the newest snapshot at
 * `T + INTERPOLATION_DELAY_TICKS`, and is dropped when the buffer's oldest snapshot passes it, with
 * the newest at `T + SNAPSHOT_BUFFER_SIZE × SNAPSHOT_EVERY_TICKS`. The difference is the window, and
 * a client drawing slower than one frame per window misses effects: 6 ticks, 100 ms, 10 fps at the
 * landed cadence. It is the price of bounding `pendingEffects` on the ingest path (#238).
 */
export const EFFECT_DRAW_WINDOW_TICKS = SNAPSHOT_BUFFER_SIZE * SNAPSHOT_EVERY_TICKS - INTERPOLATION_DELAY_TICKS;
