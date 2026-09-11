// The last few snapshots, by tick (docs/ARCHITECTURE.md §5): the interpolation brackets a
// fractional render tick between two of them. Framework-free; the store owns one.

import { SNAPSHOT_BUFFER_SIZE, type GameSnapshot } from '@evolution/shared';

/** The two snapshots around a tick; one side is `null` past the ends of the buffer. */
export interface SnapshotBracket {
  readonly older: GameSnapshot | null;
  readonly newer: GameSnapshot | null;
}

export class SnapshotBuffer {
  private readonly snapshots: GameSnapshot[] = [];

  constructor(private readonly capacity: number = SNAPSHOT_BUFFER_SIZE) {}

  /** Keeps a newer snapshot and drops the oldest past the capacity; a stale or repeated tick is ignored. */
  push(snapshot: GameSnapshot): boolean {
    const latest = this.latest();
    if (latest !== null && snapshot.tick <= latest.tick) return false;
    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.capacity) this.snapshots.shift();
    return true;
  }

  latest(): GameSnapshot | null {
    return this.snapshots[this.snapshots.length - 1] ?? null;
  }

  oldest(): GameSnapshot | null {
    return this.snapshots[0] ?? null;
  }

  size(): number {
    return this.snapshots.length;
  }

  /** The snapshots at or around `tick`: equal ticks return the same snapshot on both sides. */
  bracket(tick: number): SnapshotBracket {
    let older: GameSnapshot | null = null;
    for (const snapshot of this.snapshots) {
      if (snapshot.tick <= tick) {
        older = snapshot;
        continue;
      }
      return { older, newer: snapshot };
    }
    return { older, newer: older !== null && older.tick === tick ? older : null };
  }

  clear(): void {
    this.snapshots.length = 0;
  }
}
