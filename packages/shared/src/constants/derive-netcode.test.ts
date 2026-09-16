// What the comments in `netcode.ts` used to claim (#287). The constants compile at one cadence, so
// every "at every cadence" statement about them was prose a test could not execute; `deriveNetcode`
// takes the cadence as an argument, so each statement is a case here instead.

import { describe, expect, it } from 'vitest';
import { TICK_HZ } from './network.js';
import { deriveNetcode, type NetcodeConstants } from './derive-netcode.js';

/**
 * The cadences asserted at: every `SNAPSHOT_EVERY_TICKS` up to 6 that divides `TICK_HZ` = 60 into a
 * whole wire rate. 1 is what the room broadcast at before #214 **and the cadence at which a wrong
 * draw-window formula agrees with the right one** (#284), 3 is the landed one, 6 is the slowest
 * §4.2 lever 2 names. 5 is left out because 60/5 acknowledges at 12/s rather than 10/s, which is the
 * ack rounding's own case and belongs to the ack block below rather than to every property.
 */
const CADENCES = [1, 2, 3, 4, 6] as const;

/**
 * What the derivation must produce at `TICK_HZ` = 60, written out rather than recomputed: a test
 * that recalculates its expectation from the function it guards cannot catch that function drifting
 * (the convention `netcode.test.ts` sets at its head). Hand-derived from docs/architecture/client.md §5
 * and docs/architecture/wire-contract.md §4; the properties below say why each column is what it is.
 */
const EXPECTED_BY_CADENCE: readonly {
  readonly snapshotEveryTicks: number;
  readonly wireHz: number;
  readonly expected: NetcodeConstants;
}[] = [
  {
    snapshotEveryTicks: 1,
    wireHz: 60,
    expected: {
      snapshotBacklogLimitTicks: 60,
      snapshotAckIntervalTicks: 6,
      snapshotAckEverySnapshots: 6,
      snapshotAckEveryTicks: 6,
      interpolationDelayTicks: 2,
      snapshotBufferSize: 4,
      maxExtrapolationTicks: 1,
      effectDrawWindowTicks: 2,
    },
  },
  {
    snapshotEveryTicks: 2,
    wireHz: 30,
    expected: {
      snapshotBacklogLimitTicks: 60,
      snapshotAckIntervalTicks: 6,
      snapshotAckEverySnapshots: 3,
      snapshotAckEveryTicks: 6,
      interpolationDelayTicks: 4,
      snapshotBufferSize: 4,
      maxExtrapolationTicks: 2,
      effectDrawWindowTicks: 3,
    },
  },
  {
    snapshotEveryTicks: 3,
    wireHz: 20,
    expected: {
      snapshotBacklogLimitTicks: 60,
      snapshotAckIntervalTicks: 6,
      snapshotAckEverySnapshots: 2,
      snapshotAckEveryTicks: 6,
      interpolationDelayTicks: 6,
      snapshotBufferSize: 4,
      maxExtrapolationTicks: 3,
      effectDrawWindowTicks: 4,
    },
  },
  {
    snapshotEveryTicks: 4,
    wireHz: 15,
    expected: {
      snapshotBacklogLimitTicks: 60,
      snapshotAckIntervalTicks: 6,
      snapshotAckEverySnapshots: 1,
      snapshotAckEveryTicks: 4,
      interpolationDelayTicks: 8,
      snapshotBufferSize: 4,
      maxExtrapolationTicks: 4,
      effectDrawWindowTicks: 5,
    },
  },
  {
    snapshotEveryTicks: 6,
    wireHz: 10,
    expected: {
      snapshotBacklogLimitTicks: 60,
      snapshotAckIntervalTicks: 6,
      snapshotAckEverySnapshots: 1,
      snapshotAckEveryTicks: 6,
      interpolationDelayTicks: 12,
      snapshotBufferSize: 4,
      maxExtrapolationTicks: 6,
      effectDrawWindowTicks: 7,
    },
  },
];

/** The buffer's two inputs, repeated here rather than imported for the reason the table above gives. */
const INTERPOLATION_DELAY_INTERVALS = 2;
const BRACKET_SNAPSHOTS = 2;
/** The share of the backlog limit a healthy client may occupy before the limit stops discriminating. */
const HEALTHY_DEPTH_MAX_SHARE_OF_LIMIT = 0.25;

describe('deriveNetcode: the numbers at each cadence', () => {
  it.each(EXPECTED_BY_CADENCE)(
    'SNAPSHOT_EVERY_TICKS = $snapshotEveryTicks ($wireHz Hz)',
    ({ snapshotEveryTicks, expected }) => {
      expect(deriveNetcode(TICK_HZ, snapshotEveryTicks)).toEqual(expected);
    },
  );
});

describe('deriveNetcode: the acknowledgement gap', () => {
  it.each(CADENCES)('is the budget or less at SNAPSHOT_EVERY_TICKS = %i', (snapshotEveryTicks) => {
    const { snapshotAckIntervalTicks, snapshotAckEverySnapshots, snapshotAckEveryTicks } = deriveNetcode(
      TICK_HZ,
      snapshotEveryTicks,
    );
    // Counted in snapshots because that is what the client can count, and rounded down, so the gap
    // is never longer than the budget at a cadence that does not divide it.
    expect(snapshotAckEverySnapshots).toBeGreaterThanOrEqual(1);
    expect(snapshotAckEveryTicks).toBe(snapshotAckEverySnapshots * snapshotEveryTicks);
    expect(snapshotAckEveryTicks).toBeLessThanOrEqual(Math.max(snapshotAckIntervalTicks, snapshotEveryTicks));
  });

  it.each(CADENCES)('keeps a healthy client well inside the backlog limit at %i (#266)', (snapshotEveryTicks) => {
    // The floor of what the room measures: what a client that is keeping up perfectly still shows.
    // A cadence that pushed this at the limit would make the limit stop discriminating.
    const { snapshotAckEveryTicks, snapshotBacklogLimitTicks } = deriveNetcode(TICK_HZ, snapshotEveryTicks);
    expect(snapshotAckEveryTicks).toBeLessThanOrEqual(snapshotBacklogLimitTicks * HEALTHY_DEPTH_MAX_SHARE_OF_LIMIT);
  });

  it('errs upwards where the cadence does not divide the budget (5 ticks, 12 Hz)', () => {
    // 60/5 = 12 snapshots a second and a budget of 6 ticks: floor(6/5) = 1, so the client sends 12/s
    // rather than the 10/s the budget is named for. A shallower measured queue is the safe direction.
    const { snapshotAckEverySnapshots, snapshotAckEveryTicks } = deriveNetcode(TICK_HZ, 5);
    expect(snapshotAckEverySnapshots).toBe(1);
    expect(snapshotAckEveryTicks).toBe(5);
  });
});

describe('deriveNetcode: the buffer', () => {
  it.each(CADENCES)('holds the delay plus a bracket each side at SNAPSHOT_EVERY_TICKS = %i', (snapshotEveryTicks) => {
    const { interpolationDelayTicks, snapshotBufferSize } = deriveNetcode(TICK_HZ, snapshotEveryTicks);
    expect(interpolationDelayTicks).toBe(INTERPOLATION_DELAY_INTERVALS * snapshotEveryTicks);
    // Cadence-invariant: 4 snapshots at every cadence, spanning more ticks as the cadence slows.
    expect(snapshotBufferSize).toBe(INTERPOLATION_DELAY_INTERVALS + BRACKET_SNAPSHOTS);
  });

  it.each(CADENCES)('never rounds in the ceil at SNAPSHOT_EVERY_TICKS = %i', (snapshotEveryTicks) => {
    // Structural, not a stale number (#284): the delay is counted in whole intervals, so dividing it
    // back by the interval is exact and the `ceil` in the derivation is inert. Asserted rather than
    // "fixed", because a ceil that rounded would mean the delay had stopped being whole intervals.
    const { interpolationDelayTicks } = deriveNetcode(TICK_HZ, snapshotEveryTicks);
    const intervalsOfDelay = interpolationDelayTicks / snapshotEveryTicks;
    expect(Number.isInteger(intervalsOfDelay)).toBe(true);
    expect(Math.ceil(intervalsOfDelay)).toBe(Math.floor(intervalsOfDelay));
  });
});

describe('deriveNetcode: the effect draw window', () => {
  it.each(CADENCES)('is the bracket, less the tick the drop lands on, at %i', (snapshotEveryTicks) => {
    // The reduction: `(BRACKET_SNAPSHOTS − 1) × cadence + 1`. The bracket buys the whole budget, so a
    // faster cadence buys a tighter deadline — the direction a lever-puller will not expect.
    const { effectDrawWindowTicks } = deriveNetcode(TICK_HZ, snapshotEveryTicks);
    expect(effectDrawWindowTicks).toBe((BRACKET_SNAPSHOTS - 1) * snapshotEveryTicks + 1);
    // A bracket of 1 would leave a single tick, and only a frame landing exactly on it would fire.
    expect(effectDrawWindowTicks).toBeGreaterThan(snapshotEveryTicks);
  });

  it.each(CADENCES)('is one snapshot interval tighter than the superseded formula at %i', (snapshotEveryTicks) => {
    // The formula #284 corrected read `buffer × cadence − delay`, which is the window of an effect on
    // a broadcast tick rather than of the worst phase. It agrees with the corrected one at cadence 1
    // — every tick is a broadcast tick there — which is why three reviews did not catch it. This case
    // is the one that would have.
    const { effectDrawWindowTicks, snapshotBufferSize, interpolationDelayTicks } = deriveNetcode(
      TICK_HZ,
      snapshotEveryTicks,
    );
    const supersededWindowTicks = snapshotBufferSize * snapshotEveryTicks - interpolationDelayTicks;
    expect(supersededWindowTicks - effectDrawWindowTicks).toBe(snapshotEveryTicks - 1);
    if (snapshotEveryTicks === 1) {
      expect(effectDrawWindowTicks).toBe(supersededWindowTicks);
    } else {
      expect(effectDrawWindowTicks).toBeLessThan(supersededWindowTicks);
    }
  });
});

describe('deriveNetcode: the extrapolation cap', () => {
  it.each(CADENCES)('covers a whole missing snapshot interval at %i (§4.2 lever 2)', (snapshotEveryTicks) => {
    // A cadence bump has to carry the cap with it, or a missing bracket stops covering one snapshot
    // interval and the frame holds instead of extrapolating. Derived, it carries itself.
    const { maxExtrapolationTicks } = deriveNetcode(TICK_HZ, snapshotEveryTicks);
    expect(maxExtrapolationTicks).toBeGreaterThanOrEqual(snapshotEveryTicks);
  });

  it.each(CADENCES)('never reaches past the delay it covers at %i', (snapshotEveryTicks) => {
    // The cap only ever raises the render tick, and it stays inside the interpolation delay, so a
    // paused room holds its frame instead of running away from the newest snapshot.
    const { maxExtrapolationTicks, interpolationDelayTicks } = deriveNetcode(TICK_HZ, snapshotEveryTicks);
    expect(maxExtrapolationTicks).toBeLessThanOrEqual(interpolationDelayTicks);
  });
});
