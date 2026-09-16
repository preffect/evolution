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
 * What this build compiles to. The algebra behind these numbers is `derive-netcode.test.ts`, which
 * runs it at five cadences (#287); this file pins the values the landed cadence produces, written as
 * literals: a test that recomputes a value from the thing it guards cannot catch it drifting.
 */
const LANDED_SNAPSHOT_EVERY_TICKS = 3;
const LANDED_SNAPSHOT_HZ = 20;
const LANDED_BACKLOG_LIMIT_TICKS = 60;
const LANDED_ACK_INTERVAL_TICKS = 6;
const LANDED_ACK_EVERY_SNAPSHOTS = 2;
const LANDED_ACK_EVERY_TICKS = 6;
const LANDED_INTERPOLATION_DELAY_TICKS = 6;
const LANDED_SNAPSHOT_BUFFER_SIZE = 4;
const LANDED_MAX_EXTRAPOLATION_TICKS = 3;
/** The wall time `SNAPSHOT_ACK_INTERVAL_TICKS` is worth, for the same reason. */
const ACK_INTERVAL_MS = 100;
/**
 * The window the derivation must leave a client. It is `(BRACKET_SNAPSHOTS - 1) x SNAPSHOT_EVERY_TICKS + 1`
 * = 4 ticks at the landed 20 Hz: the worst effect phase, since the wire carries a whole interval of
 * ticks in each delta. `world-store.spec.ts` measures the cliff from the real store against the same literal.
 */
const LANDED_EFFECT_DRAW_WINDOW_TICKS = 4;
/**
 * The slowest frame rate at which a player is still owed every effect, as a window. Provisional
 * pending #288, which decides the number; the gate itself is not provisional. An effect that misses
 * its window is not drawn late, it is **never drawn**, so this is the frame rate below which a
 * player stops seeing feedback for things happening to them. 60 ms is roughly a 16 fps obligation.
 */
const MIN_EFFECT_DRAW_WINDOW_MS = 60;

describe('netcode constants', () => {
  it('broadcasts at the landed 20 Hz (#214)', () => {
    // `derive-netcode.test.ts` pins the behaviour at every cadence and not the value. #214's
    // deliverable is the value: a silent revert to 1 is the human's crash, and green without this.
    expect(Number.isInteger(SNAPSHOT_EVERY_TICKS)).toBe(true);
    expect(SNAPSHOT_EVERY_TICKS).toBe(LANDED_SNAPSHOT_EVERY_TICKS);
    expect(TICK_HZ / SNAPSHOT_EVERY_TICKS).toBe(LANDED_SNAPSHOT_HZ);
  });

  it('exports the numbers this cadence derives', () => {
    // The wiring: each constant is what `deriveNetcode(TICK_HZ, SNAPSHOT_EVERY_TICKS)` produces, so a
    // change to the derivation that nobody intended shows up here as a changed shipped number.
    expect(SNAPSHOT_BACKLOG_LIMIT_TICKS).toBe(LANDED_BACKLOG_LIMIT_TICKS);
    expect(SNAPSHOT_ACK_INTERVAL_TICKS).toBe(LANDED_ACK_INTERVAL_TICKS);
    expect(SNAPSHOT_ACK_EVERY_SNAPSHOTS).toBe(LANDED_ACK_EVERY_SNAPSHOTS);
    expect(SNAPSHOT_ACK_EVERY_TICKS).toBe(LANDED_ACK_EVERY_TICKS);
    expect(INTERPOLATION_DELAY_TICKS).toBe(LANDED_INTERPOLATION_DELAY_TICKS);
    expect(SNAPSHOT_BUFFER_SIZE).toBe(LANDED_SNAPSHOT_BUFFER_SIZE);
    expect(MAX_EXTRAPOLATION_TICKS).toBe(LANDED_MAX_EXTRAPOLATION_TICKS);
  });

  it('acknowledges on a whole tick budget (#277 item 3)', () => {
    // The budget divides the cadence exactly only while it is itself whole, which `TICK_HZ` decides:
    // the derivation is exact integer arithmetic at every cadence only for a tick rate that divides
    // by the ack rate. This is the precondition, and it is a property of `TICK_HZ`, not of a cadence.
    expect(Number.isInteger(SNAPSHOT_ACK_INTERVAL_TICKS)).toBe(true);
    expect(SNAPSHOT_ACK_EVERY_TICKS * TICK_INTERVAL_MS).toBeLessThanOrEqual(ACK_INTERVAL_MS);
  });

  it('leaves a client the worst effect phase can need, not the best (#238)', () => {
    // The wire carries `tick - SNAPSHOT_EVERY_TICKS + 1 … tick` in one delta, so an effect can arrive
    // already stale; this is the window the stalest of them still gets. `world-store.spec.ts` pins
    // the behaviour at that window, this pins the number the derivation produces.
    expect(EFFECT_DRAW_WINDOW_TICKS).toBe(LANDED_EFFECT_DRAW_WINDOW_TICKS);
  });

  it('keeps the draw floor inside what a browser client can hold (§4.2 lever 2)', () => {
    // The window shrinks with the cadence, which is the surprising direction: 2 ticks / 33 ms at
    // 60 Hz is a 30 fps obligation. This gate is the landed cadence's, so a cadence bump that pushed
    // the floor past what a browser holds fails here rather than in a player's missing effects.
    expect(EFFECT_DRAW_WINDOW_TICKS * TICK_INTERVAL_MS).toBeGreaterThanOrEqual(MIN_EFFECT_DRAW_WINDOW_MS);
  });
});
