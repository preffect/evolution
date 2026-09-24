// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ManualScheduler, SNAPSHOT_STALE_MS } from '@evolution/shared';
import { SnapshotStalenessWatch } from './snapshot-staleness';

const JUST_BEFORE_MS = SNAPSHOT_STALE_MS - 1;

function watchWithScheduler(): { watch: SnapshotStalenessWatch; scheduler: ManualScheduler } {
  const scheduler = new ManualScheduler();
  return { watch: new SnapshotStalenessWatch(scheduler), scheduler };
}

describe('SnapshotStalenessWatch', () => {
  it('is fresh until it has been started', () => {
    const { watch, scheduler } = watchWithScheduler();
    scheduler.advanceMilliseconds(SNAPSHOT_STALE_MS);
    expect(watch.isStale()).toBe(false);
  });

  it('goes stale exactly SNAPSHOT_STALE_MS after the last arrival', () => {
    const { watch, scheduler } = watchWithScheduler();
    watch.restart();
    scheduler.advanceMilliseconds(JUST_BEFORE_MS);
    expect(watch.isStale()).toBe(false);
    scheduler.advanceMilliseconds(1);
    expect(watch.isStale()).toBe(true);
  });

  it('restarts the wait on every arrival, so a steady stream never goes stale', () => {
    const { watch, scheduler } = watchWithScheduler();
    watch.restart();
    scheduler.advanceMilliseconds(JUST_BEFORE_MS);
    watch.restart();
    scheduler.advanceMilliseconds(JUST_BEFORE_MS);
    expect(watch.isStale()).toBe(false);
    expect(scheduler.pendingCallCount).toBe(1);
  });

  it('is fresh again the moment a snapshot arrives after a stall', () => {
    const { watch, scheduler } = watchWithScheduler();
    watch.restart();
    scheduler.advanceMilliseconds(SNAPSHOT_STALE_MS);
    watch.restart();
    expect(watch.isStale()).toBe(false);
  });

  it('stops: fresh, and nothing left waiting', () => {
    const { watch, scheduler } = watchWithScheduler();
    watch.restart();
    scheduler.advanceMilliseconds(SNAPSHOT_STALE_MS);
    watch.stop();
    expect(watch.isStale()).toBe(false);
    watch.restart();
    watch.stop();
    expect(scheduler.pendingCallCount).toBe(0);
  });
});
