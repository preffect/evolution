import { describe, expect, it } from 'vitest';
import { TICK_HZ, TICK_INTERVAL_MS } from './network.js';
import {
  INTERPOLATION_DELAY_TICKS,
  MAX_EXTRAPOLATION_TICKS,
  SNAPSHOT_ACK_EVERY_SNAPSHOTS,
  SNAPSHOT_ACK_EVERY_TICKS,
  SNAPSHOT_BACKLOG_LIMIT_TICKS,
  SNAPSHOT_BUFFER_SIZE,
  SNAPSHOT_EVERY_TICKS,
} from './netcode.js';

/**
 * The duration `SNAPSHOT_ACK_EVERY_SNAPSHOTS` is derived from (#277). Repeated here rather than
 * exported: a test that read the same private constant could not catch it drifting.
 */
const ACK_INTERVAL_MS = 100;
/** The share of the backlog limit a healthy client may occupy before the limit stops discriminating. */
const HEALTHY_DEPTH_MAX_SHARE_OF_LIMIT = 0.25;
/** The landed cadence and the wire rate it produces (#214): the ticket's deliverable is the value. */
const LANDED_SNAPSHOT_EVERY_TICKS = 3;
const LANDED_SNAPSHOT_HZ = 20;

describe('netcode constants', () => {
  it('broadcasts on a whole positive tick cadence', () => {
    expect(Number.isInteger(SNAPSHOT_EVERY_TICKS)).toBe(true);
    expect(SNAPSHOT_EVERY_TICKS).toBeGreaterThanOrEqual(1);
  });

  it('broadcasts at the landed 20 Hz (#214)', () => {
    // Every other test here derives from the constant, which pins the behaviour and not the value.
    // #214's deliverable is the value: a silent revert to 1 is the human's crash, and green without this.
    expect(SNAPSHOT_EVERY_TICKS).toBe(LANDED_SNAPSHOT_EVERY_TICKS);
    expect(TICK_HZ / SNAPSHOT_EVERY_TICKS).toBe(LANDED_SNAPSHOT_HZ);
  });

  it('derives the interpolation delay and the buffer from the cadence (docs/ARCHITECTURE.md §5)', () => {
    expect(INTERPOLATION_DELAY_TICKS).toBe(2 * SNAPSHOT_EVERY_TICKS);
    expect(SNAPSHOT_BUFFER_SIZE * SNAPSHOT_EVERY_TICKS).toBeGreaterThan(
      INTERPOLATION_DELAY_TICKS + SNAPSHOT_EVERY_TICKS,
    );
    // §4.2 lever 2: a cadence bump has to carry the cap with it, or a missing bracket stops covering
    // one snapshot interval and the frame holds instead of extrapolating. Zero margin at the landed 3.
    expect(MAX_EXTRAPOLATION_TICKS).toBeGreaterThanOrEqual(SNAPSHOT_EVERY_TICKS);
  });

  it('acknowledges on a duration, so the cadence cannot stretch it (#277 item 3)', () => {
    expect(SNAPSHOT_ACK_EVERY_SNAPSHOTS).toBeGreaterThanOrEqual(1);
    expect(SNAPSHOT_ACK_EVERY_TICKS).toBe(SNAPSHOT_ACK_EVERY_SNAPSHOTS * SNAPSHOT_EVERY_TICKS);
    // Rounded down, so the gap is the interval or less — never more, at a cadence that divides it or not.
    const gapMs = SNAPSHOT_ACK_EVERY_TICKS * TICK_INTERVAL_MS;
    const oneSnapshotMs = SNAPSHOT_EVERY_TICKS * TICK_INTERVAL_MS;
    expect(gapMs).toBeLessThanOrEqual(Math.max(ACK_INTERVAL_MS, oneSnapshotMs));
  });

  it('keeps a healthy client well inside the backlog limit (#266)', () => {
    // The floor of what the room measures: what a client that is keeping up perfectly still shows.
    expect(SNAPSHOT_ACK_EVERY_TICKS).toBeLessThanOrEqual(
      SNAPSHOT_BACKLOG_LIMIT_TICKS * HEALTHY_DEPTH_MAX_SHARE_OF_LIMIT,
    );
  });
});
