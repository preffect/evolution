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
 * 20 Hz, by the derivation below, and never more than `SNAPSHOT_ACK_INTERVAL_TICKS` of it at any
 * cadence; a second of it means the client is not keeping up and more snapshots would only make it
 * staler. The check runs on broadcast ticks, so the depth overshoots this by up to one
 * `SNAPSHOT_EVERY_TICKS` before the room acts (63 against 60 today, pinned in
 * `game-room-cadence.test.ts`).
 */
export const SNAPSHOT_BACKLOG_LIMIT_TICKS = TICK_HZ * SNAPSHOT_BACKLOG_LIMIT_SECONDS;

/**
 * The acknowledgement rate the budget below is named for. The rate a client actually sends at is
 * this or a little more, never less: the floor division rounds the gap down, so it is 10/s at
 * `SNAPSHOT_EVERY_TICKS` of 1, 2, 3 or 6, 15/s at 4 and 12/s at 5. Erring upwards is the safe
 * direction — a shallower measured queue, at a cost of a few tiny frames a second.
 */
const ACK_INTERVALS_PER_SECOND = 10;

/**
 * How long a client may go between acknowledgements, as a tick budget rather than a count of
 * snapshots (#277). `SNAPSHOT_BACKLOG_LIMIT_TICKS` is a second of ticks, so a cadence counted in
 * snapshots would move the floor of that measurement every time `SNAPSHOT_EVERY_TICKS` moved and one
 * lever would eat the other's headroom: a fixed 5 snapshots is 5 ticks at 60 Hz, 15 at 20 Hz and 20
 * at 15 Hz, all against the same 60-tick limit. Derived, it is 6, 6 and 4. Ticks and not
 * milliseconds so the division below is exact integer arithmetic at every `SNAPSHOT_EVERY_TICKS`;
 * this quantity is itself whole only while `TICK_HZ % ACK_INTERVALS_PER_SECOND === 0`, which
 * `netcode.test.ts` pins.
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
/**
 * Snapshots the client keeps for interpolation: the delay plus a bracket each side, **4 at either
 * cadence**. That is structural, not a coincidence of today's numbers: `INTERPOLATION_DELAY_TICKS`
 * is defined in whole intervals, so dividing it back by the interval is exact and the `ceil` never
 * rounds — `ceil(D·S / S) + B = D + B` at every cadence (#287 on why that is prose and not a test).
 */
export const SNAPSHOT_BUFFER_SIZE = Math.ceil(INTERPOLATION_DELAY_TICKS / SNAPSHOT_EVERY_TICKS) + BRACKET_SNAPSHOTS;
/** A missing bracket extrapolates with velocity for at most this many ticks, then holds. */
export const MAX_EXTRAPOLATION_TICKS = 3;
/** The server-tick estimate's EMA weight per snapshot arrival: jitter averages out, drift is tracked. */
export const SERVER_TICK_ESTIMATE_SMOOTHING = 0.1;

/**
 * Ticks a client is guaranteed to have to draw a frame in for an effect to fire, the price of
 * bounding `pendingEffects` on the ingest path (#238, docs/ARCHITECTURE.md §5).
 *
 * An effect at tick `T` becomes due when the render tick reaches it, which happens continuously at
 * `T + INTERPOLATION_DELAY_TICKS` because the render tick follows the smoothed server-tick estimate
 * rather than the snapshots. It is dropped at the first *broadcast* whose oldest buffered snapshot
 * has passed it, and a full buffer of `SNAPSHOT_BUFFER_SIZE` snapshots spaced `SNAPSHOT_EVERY_TICKS`
 * apart has its oldest at `newest − (SNAPSHOT_BUFFER_SIZE − 1) × SNAPSHOT_EVERY_TICKS`. Because the
 * drop lands on a broadcast, the window depends on the effect's phase, `T mod SNAPSHOT_EVERY_TICKS`:
 * 6 ticks at phase 0, 5 at phase 1, 4 at phase 2. The wire carries all three — the server stamps
 * `tick: world.tick` every tick and `serializeDelta` splices a whole interval of them onto the next
 * broadcast — so this constant is the **worst** phase, the one every effect is guaranteed.
 *
 * `MAX_EXTRAPOLATION_TICKS` is deliberately absent: the cap only ever raises the render tick, and an
 * effect's tick is never past the newest snapshot, so it cannot delay one becoming due.
 *
 * **Nothing reads this at runtime.** It describes a consequence of the three constants above rather
 * than causing anything: `WorldStore.dropOvertakenEffects` works off the buffer's oldest snapshot
 * directly and never sees this value. So it cannot be pinned by mutating it and watching behaviour —
 * `world-store.spec.ts` measures the cliff from the real store against a repeated literal, and
 * `netcode.test.ts` checks this against that literal. A test that imported it and fed it back would
 * assert the constant equals itself.
 *
 * The expression reduces to `(BRACKET_SNAPSHOTS − 1) × SNAPSHOT_EVERY_TICKS + 1`, which is the part
 * worth knowing before touching §4.2 lever 2: the bracket buys the whole budget, so a **faster**
 * cadence buys a **tighter** draw deadline. 4 ticks / 67 ms / 15 fps at the landed 20 Hz, but only
 * 2 ticks / 33 ms / 30 fps at 60 Hz. `netcode.test.ts` gates the floor rather than describing it.
 */
export const EFFECT_DRAW_WINDOW_TICKS =
  (SNAPSHOT_BUFFER_SIZE - 1) * SNAPSHOT_EVERY_TICKS - INTERPOLATION_DELAY_TICKS + 1;
