// The acknowledgement cadence both the browser and the server's socket tests run (docs/architecture/wire-contract.md §4).
import { describe, expect, it, vi } from 'vitest';
import { SNAPSHOT_ACK_EVERY_SNAPSHOTS } from '../constants/netcode.js';
import { SnapshotAcknowledger } from './snapshot-acknowledger.js';

const FIRST_TICK = 100;

describe('SnapshotAcknowledger', () => {
  it('acknowledges one applied snapshot in every SNAPSHOT_ACK_EVERY_SNAPSHOTS, the newest tick', () => {
    const send = vi.fn();
    const acknowledger = new SnapshotAcknowledger(send);
    for (let index = 0; index < SNAPSHOT_ACK_EVERY_SNAPSHOTS * 2; index += 1) {
      acknowledger.recordApplied(FIRST_TICK + index);
    }
    expect(send.mock.calls).toEqual([
      [FIRST_TICK + SNAPSHOT_ACK_EVERY_SNAPSHOTS - 1],
      [FIRST_TICK + SNAPSHOT_ACK_EVERY_SNAPSHOTS * 2 - 1],
    ]);
  });

  it('says nothing until the cadence is reached', () => {
    const send = vi.fn();
    const acknowledger = new SnapshotAcknowledger(send);
    for (let index = 0; index < SNAPSHOT_ACK_EVERY_SNAPSHOTS - 1; index += 1) {
      acknowledger.recordApplied(FIRST_TICK + index);
    }
    expect(send).not.toHaveBeenCalled();
  });

  it('acknowledges a full state at once and restarts the cadence from there', () => {
    const send = vi.fn();
    const acknowledger = new SnapshotAcknowledger(send);
    acknowledger.recordApplied(FIRST_TICK);
    acknowledger.acknowledgeNow(FIRST_TICK + 1);
    expect(send.mock.calls).toEqual([[FIRST_TICK + 1]]);

    for (let index = 0; index < SNAPSHOT_ACK_EVERY_SNAPSHOTS - 1; index += 1) {
      acknowledger.recordApplied(FIRST_TICK + 2 + index);
    }
    expect(send).toHaveBeenCalledTimes(1);
    acknowledger.recordApplied(FIRST_TICK + SNAPSHOT_ACK_EVERY_SNAPSHOTS + 1);
    expect(send.mock.calls.at(-1)).toEqual([FIRST_TICK + SNAPSHOT_ACK_EVERY_SNAPSHOTS + 1]);
  });
});
