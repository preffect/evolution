// Broadcast-cadence arithmetic for tests (docs/architecture/entity-model.md §1, docs/TESTING.md §4). The room
// broadcasts every `SNAPSHOT_EVERY_TICKS` ticks, so a test that reads the wire has to know which
// ticks reached it; both directions live here rather than being redefined per test file.

import { SNAPSHOT_EVERY_TICKS } from '@evolution/shared';

/** The first tick at or after `tick` on which the room broadcasts. */
export function broadcastTickAtOrAfter(tick: number): number {
  return Math.ceil(tick / SNAPSHOT_EVERY_TICKS) * SNAPSHOT_EVERY_TICKS;
}

/** The last tick at or before `tick` on which the room broadcast: what it actually put on the wire. */
export function broadcastTickAtOrBefore(tick: number): number {
  return Math.floor(tick / SNAPSHOT_EVERY_TICKS) * SNAPSHOT_EVERY_TICKS;
}
