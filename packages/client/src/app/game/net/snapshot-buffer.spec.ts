import { describe, expect, it } from 'vitest';
import { createTestSnapshot } from '@evolution/shared';
import { SNAPSHOT_PUSH, SnapshotBuffer } from './snapshot-buffer';

const snapshotAt = (tick: number) => createTestSnapshot({ tick });

describe('SnapshotBuffer', () => {
  it('keeps the newest snapshots up to its capacity, oldest first', () => {
    const buffer = new SnapshotBuffer(2);
    expect(buffer.push(snapshotAt(3))).toBe(SNAPSHOT_PUSH.appended);
    expect(buffer.push(snapshotAt(6))).toBe(SNAPSHOT_PUSH.appended);
    expect(buffer.push(snapshotAt(9))).toBe(SNAPSHOT_PUSH.appended);
    expect(buffer.size()).toBe(2);
    expect(buffer.oldest()?.tick).toBe(6);
    expect(buffer.latest()?.tick).toBe(9);
  });

  it('ignores a stale tick', () => {
    const buffer = new SnapshotBuffer();
    buffer.push(snapshotAt(6));
    expect(buffer.push(snapshotAt(3))).toBe(SNAPSHOT_PUSH.stale);
    expect(buffer.size()).toBe(1);
    expect(buffer.latest()?.tick).toBe(6);
  });

  it('replaces the latest snapshot with a republished one at the same tick', () => {
    const buffer = new SnapshotBuffer();
    buffer.push(snapshotAt(3));
    buffer.push(snapshotAt(6));
    const republished = createTestSnapshot({ tick: 6, roundTimeLeftMs: 1 });
    expect(buffer.push(republished)).toBe(SNAPSHOT_PUSH.replaced);
    expect(buffer.size()).toBe(2);
    expect(buffer.latest()).toBe(republished);
    expect(buffer.bracket(6)).toMatchObject({ older: republished, newer: republished });
  });

  it('brackets a tick between the two snapshots around it', () => {
    const buffer = new SnapshotBuffer();
    [3, 6, 9].forEach((tick) => buffer.push(snapshotAt(tick)));
    const bracket = buffer.bracket(7);
    expect(bracket.older?.tick).toBe(6);
    expect(bracket.newer?.tick).toBe(9);
  });

  it('returns the same snapshot on both sides at an exact tick and one side past the ends', () => {
    const buffer = new SnapshotBuffer();
    [3, 6].forEach((tick) => buffer.push(snapshotAt(tick)));
    expect(buffer.bracket(6)).toMatchObject({ older: { tick: 6 }, newer: { tick: 6 } });
    expect(buffer.bracket(10)).toMatchObject({ older: { tick: 6 }, newer: null });
    expect(buffer.bracket(1)).toMatchObject({ older: null, newer: { tick: 3 } });
  });

  it('is empty after clear', () => {
    const buffer = new SnapshotBuffer();
    buffer.push(snapshotAt(1));
    buffer.clear();
    expect(buffer.latest()).toBeNull();
    expect(buffer.bracket(1)).toEqual({ older: null, newer: null });
  });
});
