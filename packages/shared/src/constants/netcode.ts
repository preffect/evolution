// Snapshot encoding constants (docs/CODE-STANDARDS.md §2, docs/architecture/wire-contract.md §4.1). Engineering
// constants, not tunables: excluded from `data/balance.json`. The client-side netcode numbers
// (buffer size, interpolation delay, reconciliation) live here too. Everything below that moves with
// the cadence comes from `deriveNetcode` (`derive-netcode.ts`), which `derive-netcode.test.ts`
// executes at five cadences; this file is the list of named values with their units (#287).

import { BYTES_PER_KIBIBYTE } from './units.js';
import { TICK_HZ } from './network.js';
import { deriveNetcode, SNAPSHOT_BACKLOG_LIMIT_SECONDS } from './derive-netcode.js';

/** Positions on the wire are rounded to this many decimals (0.1 wu): what keeps a snapshot under budget. */
export const SNAPSHOT_POSITION_DECIMALS = 1;

// ---- the other snapshot numbers (#341, docs/architecture/wire-contract.md §4.2 lever 3): only the view is rounded ----
/** A radius is a length like a position, so its rim is as exact as its centre: at most 0.05 wu off. */
export const SNAPSHOT_RADIUS_DECIMALS = SNAPSHOT_POSITION_DECIMALS;
/**
 * 0.1 wu/s: extrapolation carries it for at most `MAX_EXTRAPOLATION_TICKS`, so a position drifts 0.0025 wu at most
 * at the landed cadence. The cap is one snapshot interval (#287), so a slower cadence drifts in proportion —
 * `wire-precision.spec.ts` computes the bound from the constant rather than from this number.
 */
export const SNAPSHOT_VELOCITY_DECIMALS = 1;
/**
 * 0.1 mass, for a cell and its leaderboard row alike, so the two whole numbers the HUD shows for one cell always
 * agree. At `CELL_STARTING_MASS` the engulf ratio a client reads moves by 0.5 % at most.
 */
export const SNAPSHOT_MASS_DECIMALS = 1;
/**
 * 0.01 mass/s for `MassFlowView.ratesPerSecond` (#383): at 0.1 the broth decay `(m − 20) × 0.002` would round to 0
 * below mass 45 and the vent share below about 70, and the causes would stop adding up to the net rate.
 */
export const SNAPSHOT_MASS_RATE_DECIMALS = 2;
/** `MassFlowView.decayTraitShare`: −0.235 (Mitochondrion I with Chloroplast I) is exact at three places. */
export const SNAPSHOT_SHARE_DECIMALS = 3;
/** A leaderboard score is written whole: the panel only ever shows it rounded, so the rounding is invisible. */
export const SNAPSHOT_SCORE_DECIMALS = 0;

/**
 * Ticks between two `game_snapshot` broadcasts (docs/architecture/entity-model.md §1): the one home of the
 * cadence, read by `GameRoom.runTick`. 3 at `TICK_HZ` = 60, so the wire runs at 20 Hz — a third
 * of the bytes the room sent while it broadcast every tick, which is what §4.1 budgets (#214).
 * It is also §4.2 lever 2: every number in the derived block below moves when it moves.
 */
export const SNAPSHOT_EVERY_TICKS = 3;

/** The one derivation, at this build's two levers. `derive-netcode.ts` holds the algebra and its reasons. */
const derived = deriveNetcode(TICK_HZ, SNAPSHOT_EVERY_TICKS);

/**
 * What a room may push to one client (docs/architecture/wire-contract.md §4.1): the *budgeted* per-client wire,
 * which assumes §4.2 lever 1 (viewport culling, #171). The uncut contract is about 800 KB/s at the
 * 20 Hz cadence, so the byte limit below is nearer two thirds of a second of today's worst-case
 * traffic than the whole second it names; it becomes a true second once lever 1 lands.
 */
const CLIENT_WIRE_BUDGET_BYTES_PER_SECOND = 500 * BYTES_PER_KIBIBYTE;

/**
 * Ticks of snapshots that may be in flight to one client before the room stops adding to them
 * (#266, docs/architecture/wire-contract.md §4): the client acknowledges the newest tick it has applied, and the
 * difference from the newest tick the room sent it is the depth of the queue between them —
 * wherever that queue actually sits (the room's socket, a dev proxy, the kernel, the browser). The depth counts from
 * the ack, or from where the stream restarted after a resync hold that sent nothing, whichever is newer (#655).
 * A healthy client's depth is the ack cadence plus the round trip, never more than
 * `SNAPSHOT_ACK_INTERVAL_TICKS` of it at any cadence (`derive-netcode.test.ts`); a second of it
 * means the client is not keeping up and more snapshots would only make it staler. The room stops only once the
 * depth is past this and the client holds `SNAPSHOT_ACK_EVERY_SNAPSHOTS` deltas past its ack (with fewer it owes no
 * ack). The check runs on broadcast ticks, so what is in flight when it stops is at most the larger of this plus one
 * `SNAPSHOT_EVERY_TICKS` (63 against 60 today on a regular stream, pinned in `game-room-cadence.test.ts`) and
 * `SNAPSHOT_ACK_EVERY_SNAPSHOTS` − 1 deltas past the ack, whatever ticks they span.
 */
export const SNAPSHOT_BACKLOG_LIMIT_TICKS = derived.snapshotBacklogLimitTicks;

/**
 * How long a client may go between acknowledgements, as a tick budget rather than a count of
 * snapshots (#277): why a count would let one lever eat the other's headroom is
 * docs/architecture/wire-contract.md §4, and `derive-netcode.test.ts` executes the gap it produces at
 * every cadence. Ticks and not milliseconds so the division is exact integer arithmetic; this
 * quantity is itself whole only while `TICK_HZ` divides by the ack rate, which `netcode.test.ts` pins.
 */
export const SNAPSHOT_ACK_INTERVAL_TICKS = derived.snapshotAckIntervalTicks;

/** The budget above in snapshots, which is what the client can count: rounded down, never below one. */
export const SNAPSHOT_ACK_EVERY_SNAPSHOTS = derived.snapshotAckEverySnapshots;

/** What the derivation guarantees: the acknowledgement gap in ticks, whatever the cadence. */
export const SNAPSHOT_ACK_EVERY_TICKS = derived.snapshotAckEveryTicks;

/**
 * Unsent bytes on a connection at which the room stops queueing deltas for it (#266,
 * docs/architecture/wire-contract.md §4). A client that cannot drain the cadence would otherwise be queued every
 * snapshot the room ever sent it, so its view falls behind for good and the server holds the
 * backlog. Above the limit the connection is sent nothing; when it drains it is sent one
 * `game_state` in place of the next delta, and is current again.
 */
export const SNAPSHOT_BACKLOG_LIMIT_BYTES = CLIENT_WIRE_BUDGET_BYTES_PER_SECOND * SNAPSHOT_BACKLOG_LIMIT_SECONDS;

// ---- client interpolation (docs/architecture/client.md §5, #99), derived from the cadence ----
/** Remote entities render this many ticks behind the newest snapshot: two snapshot intervals. */
export const INTERPOLATION_DELAY_TICKS = derived.interpolationDelayTicks;
/**
 * The same delay in whole broadcasts, for a consumer that counts snapshots rather than ticks
 * (`interest.ts`, which spans the client's render delay in camera states). The division back is exact
 * at every cadence and `derive-netcode.test.ts` asserts that, so this is the one home of it (#287).
 */
export const INTERPOLATION_DELAY_INTERVALS = derived.interpolationDelayIntervals;
/** Snapshots the client keeps for interpolation: the delay plus a bracket each side, 4 at every cadence. */
export const SNAPSHOT_BUFFER_SIZE = derived.snapshotBufferSize;
/** A missing bracket extrapolates with velocity for at most this many ticks, then holds: one interval. */
export const MAX_EXTRAPOLATION_TICKS = derived.maxExtrapolationTicks;
/** The server-tick estimate's EMA weight per snapshot arrival: jitter averages out, drift is tracked. */
export const SERVER_TICK_ESTIMATE_SMOOTHING = 0.1;

/**
 * Ticks a client is guaranteed to have to draw a frame in for an effect to fire, the price of
 * bounding `pendingEffects` on the ingest path (#238, docs/architecture/client.md §5). It is the *worst*
 * effect phase — the wire carries a whole interval of ticks in each delta, and the drop lands on a
 * broadcast, so the window depends on `T mod SNAPSHOT_EVERY_TICKS` (6 / 5 / 4 ticks today).
 *
 * **Nothing reads this at runtime.** It describes a consequence of the constants above rather than
 * causing anything: `WorldStore.dropOvertakenEffects` works off the buffer's oldest snapshot directly
 * and never sees this value. So it cannot be pinned by mutating it and watching behaviour —
 * `world-store.spec.ts` measures the cliff from the real store against a repeated literal, and
 * `netcode.test.ts` checks this against that literal. A test that imported it and fed it back would
 * assert the constant equals itself. `constants-ledger.test.ts` keeps the "no consumer" claim true.
 *
 * The part worth knowing before pulling §4.2 lever 2 is the direction: the bracket buys the whole
 * budget, so a **faster** cadence buys a **tighter** draw deadline — 4 ticks / 67 ms / 15 fps at the
 * landed 20 Hz, 2 ticks / 33 ms / 30 fps at 60 Hz. `derive-netcode.test.ts` executes that at five
 * cadences and `netcode.test.ts` gates the floor rather than describing it.
 */
export const EFFECT_DRAW_WINDOW_TICKS = derived.effectDrawWindowTicks;

// ---- own-cell prediction and reconciliation (docs/architecture/client.md §5, #265) ----
/**
 * A prediction error at or above this is snapped rather than blended (wu): a respawn, a `debug_set_player` teleport, a
 * shove from a much larger cell. About three starting radii (`CELL_RADIUS_SCALE × √CELL_STARTING_MASS` ≈ 18 wu); an
 * ordinary miss — the server coalescing two inputs into one tick, a separation push — is a few wu.
 */
export const RECONCILE_SNAP_DISTANCE_WU = 60;
/** A smaller error is blended out linearly over this long, so a correction never reads as a jump. */
export const RECONCILE_BLEND_SECONDS = 0.15;
/**
 * The most unacknowledged inputs the prediction replays: half a second of ticks. A link slower than that is not
 * predicted further ahead; the own cell then holds its lead and the reconciliation absorbs the rest.
 */
export const MAX_PREDICTION_TICKS = TICK_HZ / 2;
/**
 * Inputs sent since the newest snapshot arrived that the prediction still steps through (#265): past this the room
 * has stopped answering — a `debug_pause_room`, a stall — and the own cell holds, as the render tick holds at the
 * extrapolation cap. A quarter second (15 ticks, five snapshot intervals): one late snapshot on a routed link, not
 * localhost, must not freeze the own cell, while a paused room still holds it at most this far past the last real
 * arrival (a debug republish does not count as one).
 */
export const PREDICTION_STALL_TICKS = TICK_HZ / 4;
