// The connection banner's whole record (docs/ui/overlays.md §3.6): whether it shows, what it says and
// which colour role carries it. The component binds this and decides nothing.

import type { ValueOf } from '@evolution/shared';
import { CONNECTION_STATE, type ConnectionState } from '../../net/connection-state';

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
 * How many notice rows are up along the top edge: the banner, the server-error line, both or neither.
 * The top-anchored chrome drops by this many rows so a notice never covers it.
 */
export function noticeRowCountFor(state: ConnectionState, serverError: string | null): number {
  const bannerRows = connectionBannerFor(state).isVisible ? 1 : 0;
  const errorRows = serverError === null ? 0 : 1;
  return bannerRows + errorRows;
}
