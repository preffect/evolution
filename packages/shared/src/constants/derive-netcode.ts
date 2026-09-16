// The one derivation behind the cadence-dependent numbers in `netcode.ts` (docs/architecture/client.md §5,
// docs/architecture/wire-contract.md §4). A pure function of the two levers — the tick rate and the broadcast
// cadence — so that the claims those numbers carry can be executed at cadences this build does not
// compile at: `netcode.ts` calls it once with `TICK_HZ` and `SNAPSHOT_EVERY_TICKS` and names the
// result, and `derive-netcode.test.ts` calls it at `snapshotEveryTicks` = 1, 2, 3, 4 and 6 and
// asserts the invariants (#287). Nothing else calls it; it is not in the constants barrel.

/**
 * The netcode numbers that move with the cadence. Each one is exported from `netcode.ts` under its
 * own `UPPER_SNAKE_CASE` name with its unit and its owner — these are those names, one case down.
 */
export interface NetcodeConstants {
  /** Ticks of snapshots that may be in flight to one client before the room stops adding to them. */
  readonly snapshotBacklogLimitTicks: number;
  /** How long a client may go between acknowledgements, as a tick budget rather than a count. */
  readonly snapshotAckIntervalTicks: number;
  /** That budget in snapshots, which is what the client can count. */
  readonly snapshotAckEverySnapshots: number;
  /** The acknowledgement gap the budget actually produces, in ticks. */
  readonly snapshotAckEveryTicks: number;
  /** How far behind the newest snapshot remote entities are drawn. */
  readonly interpolationDelayTicks: number;
  /** Snapshots the client keeps for interpolation. */
  readonly snapshotBufferSize: number;
  /** How long a missing bracket is carried forward with velocity before the frame holds. */
  readonly maxExtrapolationTicks: number;
  /** Ticks a client is guaranteed to have to draw a frame in for an effect to fire. */
  readonly effectDrawWindowTicks: number;
}

/** How far behind the room's own stream a client may fall before it is skipped. */
export const SNAPSHOT_BACKLOG_LIMIT_SECONDS = 1;

/**
 * The acknowledgement rate the tick budget is named for. The rate a client actually sends at is this
 * or a little more, never less: the floor division below rounds the gap down. Erring upwards is the
 * safe direction — a shallower measured queue, at a cost of a few tiny frames a second.
 */
const ACK_INTERVALS_PER_SECOND = 10;
/** At least one: a client cannot acknowledge between broadcasts, so a cadence slower than the budget still sends. */
const MIN_ACK_SNAPSHOTS = 1;

/** Remote entities render this many snapshot intervals behind the newest snapshot. */
const INTERPOLATION_DELAY_INTERVALS = 2;
/** The buffer spans the delay plus one bracketing snapshot on each side. */
const BRACKET_SNAPSHOTS = 2;
/** A missing bracket is one snapshot interval wide, so the cap that covers it is one interval. */
const EXTRAPOLATION_INTERVALS = 1;

/**
 * The netcode numbers at a tick rate and a broadcast cadence. Total and pure: every caller passes
 * its own two levers, and the test passes cadences the build has never run at.
 *
 * `snapshotAckIntervalTicks` is whole only while `tickHz % ACK_INTERVALS_PER_SECOND === 0`, which is
 * a property of the tick rate rather than of this function; `netcode.test.ts` pins it for `TICK_HZ`.
 */
export function deriveNetcode(tickHz: number, snapshotEveryTicks: number): NetcodeConstants {
  const snapshotAckIntervalTicks = tickHz / ACK_INTERVALS_PER_SECOND;
  // Rounded **down**, so the acknowledgement never falls further apart than the budget at a cadence
  // that does not divide it (at 15 Hz, rounding up would be 8 ticks against a budget of 6).
  const snapshotAckEverySnapshots = Math.max(
    MIN_ACK_SNAPSHOTS,
    Math.floor(snapshotAckIntervalTicks / snapshotEveryTicks),
  );
  const interpolationDelayTicks = INTERPOLATION_DELAY_INTERVALS * snapshotEveryTicks;
  // The `ceil` never rounds: the delay is counted in whole intervals, so dividing it back by the
  // interval is exact and the buffer is `INTERPOLATION_DELAY_INTERVALS + BRACKET_SNAPSHOTS` at every
  // cadence. It is kept for the day the delay is expressed in ticks directly; the test pins that it
  // is inert rather than letting it be mistaken for a rounding that happens not to fire today.
  const snapshotBufferSize = Math.ceil(interpolationDelayTicks / snapshotEveryTicks) + BRACKET_SNAPSHOTS;
  return {
    snapshotBacklogLimitTicks: tickHz * SNAPSHOT_BACKLOG_LIMIT_SECONDS,
    snapshotAckIntervalTicks,
    snapshotAckEverySnapshots,
    snapshotAckEveryTicks: snapshotAckEverySnapshots * snapshotEveryTicks,
    interpolationDelayTicks,
    snapshotBufferSize,
    maxExtrapolationTicks: EXTRAPOLATION_INTERVALS * snapshotEveryTicks,
    // A full buffer's oldest snapshot is `(size − 1) × cadence` behind its newest, and the drop is
    // half-open, so the effect on the tick the buffer has just reached is still drawable: the worst
    // effect phase gets `(BRACKET_SNAPSHOTS − 1) × cadence + 1` ticks. The bracket buys the whole
    // budget, which is why a faster cadence buys a tighter deadline (docs/architecture/client.md §5).
    effectDrawWindowTicks: (snapshotBufferSize - 1) * snapshotEveryTicks - interpolationDelayTicks + 1,
  };
}
