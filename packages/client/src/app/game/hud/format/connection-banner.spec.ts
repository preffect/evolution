// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  CONNECTION_BANNER_TEXT,
  CONNECTION_BANNER_TONE,
  CONNECTION_STATE,
  connectionBannerFor,
  connectionStateFor,
  noticeRowCountFor,
} from './connection-banner';

describe('noticeRowCountFor', () => {
  it('counts the banner and the error line, each one row', () => {
    expect(noticeRowCountFor(CONNECTION_STATE.connected, null)).toBe(0);
    expect(noticeRowCountFor(CONNECTION_STATE.disconnected, null)).toBe(1);
    expect(noticeRowCountFor(CONNECTION_STATE.connected, 'nope')).toBe(1);
    expect(noticeRowCountFor(CONNECTION_STATE.disconnected, 'nope')).toBe(2);
    expect(noticeRowCountFor(CONNECTION_STATE.stale, null)).toBe(1);
  });
});

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

  it('says the server is quiet, in the level role, while the snapshots have stopped', () => {
    expect(connectionBannerFor(CONNECTION_STATE.stale)).toEqual({
      isVisible: true,
      text: CONNECTION_BANNER_TEXT.stale,
      tone: CONNECTION_BANNER_TONE.levelGold,
    });
    expect(CONNECTION_BANNER_TEXT.stale).toBe('Waiting for server…');
  });
});

describe('connectionStateFor', () => {
  it('puts a closed socket first, since it brings no snapshots either', () => {
    expect(connectionStateFor(false, false)).toBe(CONNECTION_STATE.disconnected);
    expect(connectionStateFor(false, true)).toBe(CONNECTION_STATE.disconnected);
  });

  it('is stale only with the socket up and the snapshots stopped', () => {
    expect(connectionStateFor(true, true)).toBe(CONNECTION_STATE.stale);
    expect(connectionStateFor(true, false)).toBe(CONNECTION_STATE.connected);
  });
});
