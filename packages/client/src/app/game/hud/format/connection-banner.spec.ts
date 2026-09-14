import { describe, expect, it } from 'vitest';
import {
  CONNECTION_BANNER_TEXT,
  CONNECTION_BANNER_TONE,
  CONNECTION_STATE,
  connectionBannerFor,
} from './connection-banner';

describe('connectionBannerFor', () => {
  it('shows nothing while connected', () => {
    expect(connectionBannerFor(CONNECTION_STATE.connected)).toEqual({ isVisible: false, text: '', tone: null });
  });

  it('says the connection is lost, in the danger role, while the socket is down (docs/ui/overlays.md §3.6)', () => {
    expect(connectionBannerFor(CONNECTION_STATE.disconnected)).toEqual({
      isVisible: true,
      text: CONNECTION_BANNER_TEXT.disconnected,
      tone: CONNECTION_BANNER_TONE.danger,
    });
    expect(CONNECTION_BANNER_TEXT.disconnected).toBe('Connection lost · reconnecting…');
  });
});
