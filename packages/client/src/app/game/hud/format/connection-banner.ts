// The connection banner's whole record (docs/ui/overlays.md §3.6): whether it shows, what it says and
// which colour role carries it. The component binds this and decides nothing.

export const CONNECTION_STATE = {
  connected: 'connected',
  /** The socket is down; it reconnects on its own while the seat's grace runs. */
  disconnected: 'disconnected',
} as const;

export type ConnectionState = (typeof CONNECTION_STATE)[keyof typeof CONNECTION_STATE];

/** The colour role the banner's rim and text take; never the only carrier, the text says it too. */
export const CONNECTION_BANNER_TONE = {
  danger: 'danger',
} as const;

export type ConnectionBannerTone = (typeof CONNECTION_BANNER_TONE)[keyof typeof CONNECTION_BANNER_TONE];

/** docs/ui/overlays.md §3.6's banner text. */
export const CONNECTION_BANNER_TEXT = {
  disconnected: 'Connection lost · reconnecting…',
} as const;

export interface ConnectionBanner {
  readonly isVisible: boolean;
  readonly text: string;
  readonly tone: ConnectionBannerTone | null;
}

const NO_BANNER: ConnectionBanner = { isVisible: false, text: '', tone: null };

export function connectionBannerFor(state: ConnectionState): ConnectionBanner {
  if (state === CONNECTION_STATE.connected) return NO_BANNER;
  return { isVisible: true, text: CONNECTION_BANNER_TEXT.disconnected, tone: CONNECTION_BANNER_TONE.danger };
}
