// The client's half of the snapshot flow control (#266, docs/architecture/wire-contract.md §4): it tells the
// server the newest tick it has actually applied, so the room can see the queue between them —
// wherever that queue sits — and stop adding to it instead of letting the client's view fall
// behind for good. One acknowledgement every `SNAPSHOT_ACK_EVERY_SNAPSHOTS` applied deltas, and
// one immediately for a `game_state`: a full state is the moment the two are in step again, and
// the server is waiting to hear it.
//
// Framework-free and shared (#664): the client's `RenderSession` owns one and feeds it every snapshot it applies, and
// the server's socket tests acknowledge through the same class, so they cannot drift from the browser's cadence.

import { SNAPSHOT_ACK_EVERY_SNAPSHOTS } from '../constants/netcode.js';

export class SnapshotAcknowledger {
  private appliedSinceAcknowledgement = 0;

  constructor(
    private readonly send: (tick: number) => void,
    private readonly everySnapshots: number = SNAPSHOT_ACK_EVERY_SNAPSHOTS,
  ) {}

  /**
   * A delta was applied: acknowledged on the `everySnapshots`-th since the last acknowledgement (the N-th, 2N-th, …), a
   * `game_state` restarting the count. The server skips a client only while it owes one of these (#655), so the two
   * cadences must agree.
   */
  recordApplied(tick: number): void {
    this.appliedSinceAcknowledgement += 1;
    if (this.appliedSinceAcknowledgement < this.everySnapshots) return;
    this.acknowledgeNow(tick);
  }

  /** A full state was applied: the client's view jumped to `tick`, so the server hears it at once. */
  acknowledgeNow(tick: number): void {
    this.appliedSinceAcknowledgement = 0;
    this.send(tick);
  }
}
