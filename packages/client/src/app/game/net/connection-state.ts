// The connection's state as the client sees it (docs/ui/overlays.md §3.6): the socket's own flag, and whether the
// snapshots have stopped while it is up. `net/` owns the fact; the banner (`hud/format/connection-banner.ts`) only
// words it.

import type { ValueOf } from '@evolution/shared';

export const CONNECTION_STATE = {
  connected: 'connected',
  /** The socket is down; it reconnects on its own while the seat's grace runs. */
  disconnected: 'disconnected',
  /** The socket is up but no snapshot has come for `SNAPSHOT_STALE_MS`: the server is quiet (or paused). */
  stale: 'stale',
} as const;

export type ConnectionState = ValueOf<typeof CONNECTION_STATE>;

/**
 * The state the connection facts add up to: the socket's own flag first, since a closed socket brings no snapshots
 * either, then whether the snapshots have stopped coming (docs/ui/overlays.md §3.6).
 */
export function connectionStateFor(isSocketConnected: boolean, isSnapshotStale: boolean): ConnectionState {
  if (!isSocketConnected) return CONNECTION_STATE.disconnected;
  return isSnapshotStale ? CONNECTION_STATE.stale : CONNECTION_STATE.connected;
}
