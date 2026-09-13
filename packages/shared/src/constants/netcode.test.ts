import { describe, expect, it } from 'vitest';
import { TICK_HZ, TICK_INTERVAL_MS } from './network.js';
import {
  INTERPOLATION_DELAY_TICKS,
  MAX_EXTRAPOLATION_TICKS,
  EFFECT_DRAW_WINDOW_TICKS,
  SNAPSHOT_ACK_EVERY_SNAPSHOTS,
  SNAPSHOT_ACK_EVERY_TICKS,
  SNAPSHOT_ACK_INTERVAL_TICKS,
  SNAPSHOT_BACKLOG_LIMIT_TICKS,
  SNAPSHOT_BUFFER_SIZE,
  SNAPSHOT_EVERY_TICKS,
} from './netcode.js';

/**
 * The wall time `SNAPSHOT_ACK_INTERVAL_TICKS` is worth. Repeated here rather than derived from the
 * constant: a test that recomputes a value from the thing it guards cannot catch that thing drifting.
 */
const ACK_INTERVAL_MS = 100;
/**
 * The window the derivation must leave a client, repeated for the same reason. It is
 * `(BRACKET_SNAPSHOTS - 1) x SNAPSHOT_EVERY_TICKS + 1` = 4 ticks at the landed 20 Hz: the worst
 * effect phase, since the wire carries a whole interval of ticks in each delta.
 */
const LANDED_EFFECT_DRAW_WINDOW_TICKS = 4;
/**
 * The slowest frame rate at which a player is still owed every effect, as a window. Provisional
 * pending #288, which decides the number; the gate itself is not provisional. An effect that misses
 * its window is not drawn late, it is **never drawn**, so this is the frame rate below which a
 * player stops seeing feedback for things happening to them. 60 ms is roughly a 16 fps obligation.
 */
const MIN_EFFECT_DRAW_WINDOW_MS = 60;
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
    // The budget divides the cadence exactly only while it is itself whole, which `TICK_HZ` decides.
    expect(Number.isInteger(SNAPSHOT_ACK_INTERVAL_TICKS)).toBe(true);
    // Rounded down, so the gap is the interval or less — never more, at a cadence that divides it or not.
    const gapMs = SNAPSHOT_ACK_EVERY_TICKS * TICK_INTERVAL_MS;
    const oneSnapshotMs = SNAPSHOT_EVERY_TICKS * TICK_INTERVAL_MS;
    expect(gapMs).toBeLessThanOrEqual(Math.max(ACK_INTERVAL_MS, oneSnapshotMs));
  });

  it('leaves a client the worst effect phase can need, not the best (#238)', () => {
    // The wire carries `tick - SNAPSHOT_EVERY_TICKS + 1 … tick` in one delta, so an effect can arrive
    // already stale; this is the window the stalest of them still gets. `world-store.spec.ts` pins
    // the behaviour at that window, this pins the number the derivation produces.
    expect(EFFECT_DRAW_WINDOW_TICKS).toBe(LANDED_EFFECT_DRAW_WINDOW_TICKS);
  });

  it('always leaves a frame per snapshot interval to draw an effect in', () => {
    // The bracket is the whole draw budget, so a bracket of 1 would leave a single tick and only a
    // frame landing exactly on it would fire anything.
    expect(EFFECT_DRAW_WINDOW_TICKS).toBeGreaterThanOrEqual(SNAPSHOT_EVERY_TICKS + 1);
  });

  it('keeps the draw floor inside what a browser client can hold (§4.2 lever 2)', () => {
    // The window shrinks with the cadence, which is the surprising direction: 2 ticks / 33 ms at
    // 60 Hz is a 30 fps obligation. A cadence bump has to carry `BRACKET_SNAPSHOTS` with it, the way
    // the extrapolation pin above makes a cadence bump carry `MAX_EXTRAPOLATION_TICKS`.
    expect(EFFECT_DRAW_WINDOW_TICKS * TICK_INTERVAL_MS).toBeGreaterThanOrEqual(MIN_EFFECT_DRAW_WINDOW_MS);
  });

  it('keeps a healthy client well inside the backlog limit (#266)', () => {
    // The floor of what the room measures: what a client that is keeping up perfectly still shows.
    expect(SNAPSHOT_ACK_EVERY_TICKS).toBeLessThanOrEqual(
      SNAPSHOT_BACKLOG_LIMIT_TICKS * HEALTHY_DEPTH_MAX_SHARE_OF_LIMIT,
    );
  });
});
