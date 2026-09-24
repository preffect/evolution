// The connection banner's whole record (docs/ui/overlays.md §3.6): whether it shows, what it says and
// which colour role carries it. The component binds this and decides nothing.

import type { ValueOf } from '@evolution/shared';

export const CONNECTION_STATE = {
  connected: 'connected',
  /** The socket is down; it reconnects on its own while the seat's grace runs. */
  disconnected: 'disconnected',
  /** The socket is up but no snapshot has come for `SNAPSHOT_STALE_MS`: the server is quiet (or paused). */
  stale: 'stale',
} as const;

export type ConnectionState = ValueOf<typeof CONNECTION_STATE>;

/** The colour role the banner's rim and text take; never the only carrier, the text says it too. */
export const CONNECTION_BANNER_TONE = {
  danger: 'danger',
  levelGold: 'level-gold',
} as const;

export type ConnectionBannerTone = ValueOf<typeof CONNECTION_BANNER_TONE>;

/** docs/ui/overlays.md §3.6's banner text. */
export const CONNECTION_BANNER_TEXT = {
  disconnected: 'Connection lost · reconnecting…',
  stale: 'Waiting for server…',
} as const;

export interface ConnectionBanner {
  readonly isVisible: boolean;
  readonly text: string;
  readonly tone: ConnectionBannerTone | null;
}

const BANNER_BY_STATE: Readonly<Record<ConnectionState, ConnectionBanner>> = {
  [CONNECTION_STATE.connected]: { isVisible: false, text: '', tone: null },
  [CONNECTION_STATE.disconnected]: {
    isVisible: true,
    text: CONNECTION_BANNER_TEXT.disconnected,
    tone: CONNECTION_BANNER_TONE.danger,
  },
  [CONNECTION_STATE.stale]: {
    isVisible: true,
    text: CONNECTION_BANNER_TEXT.stale,
    tone: CONNECTION_BANNER_TONE.levelGold,
  },
};

export function connectionBannerFor(state: ConnectionState): ConnectionBanner {
  return BANNER_BY_STATE[state];
}

/**
 * The state the connection facts add up to: the socket's own flag first, since a closed socket brings no snapshots
 * either, then whether the snapshots have stopped coming (docs/ui/overlays.md §3.6).
 */
export function connectionStateFor(isSocketConnected: boolean, isSnapshotStale: boolean): ConnectionState {
  if (!isSocketConnected) return CONNECTION_STATE.disconnected;
  return isSnapshotStale ? CONNECTION_STATE.stale : CONNECTION_STATE.connected;
}

/**
 * How many notice rows are up along the top edge: the banner, the server-error line, both or neither.
 * The top-anchored chrome drops by this many rows so a notice never covers it.
 */
export function noticeRowCountFor(state: ConnectionState, serverError: string | null): number {
  const bannerRows = connectionBannerFor(state).isVisible ? 1 : 0;
  const errorRows = serverError === null ? 0 : 1;
  return bannerRows + errorRows;
}
