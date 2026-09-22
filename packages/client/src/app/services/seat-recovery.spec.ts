// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  SERVER_MESSAGE_TYPE,
  createTestSessionConfig,
  createTestSnapshot,
  gameId,
  playerId,
} from '@evolution/shared';
import type { ServerMessage } from '@evolution/shared';
import { SEAT_RECOVERY_OUTCOME, SeatRecovery } from './seat-recovery';

const GAME_STATE: ServerMessage = {
  type: SERVER_MESSAGE_TYPE.gameState,
  gameId: gameId('room'),
  playerId: playerId('me'),
  snapshot: createTestSnapshot(),
  balance: DEFAULT_BALANCE,
  config: createTestSessionConfig(),
  playerIds: [playerId('me')],
  avatarAssignments: {},
};
const LOBBY_UPDATE: ServerMessage = { type: SERVER_MESSAGE_TYPE.lobbyUpdate, games: [] };
const NOTHING_TO_DO = { shouldReannounce: false, isSeatLost: false };
const REANNOUNCE = { shouldReannounce: true, isSeatLost: false };

describe('SeatRecovery', () => {
  it('does nothing on the first open, and every frame is ordinary traffic', () => {
    const recovery = new SeatRecovery();
    expect(recovery.socketReopened(true)).toEqual(NOTHING_TO_DO);
    expect(recovery.frameReceived(LOBBY_UPDATE)).toBe(SEAT_RECOVERY_OUTCOME.none);
  });

  it('re-announces after a mid-round drop and resyncs when the first frame is the room’s game_state', () => {
    const recovery = new SeatRecovery();
    recovery.socketDropped(true);
    expect(recovery.socketReopened(true)).toEqual(REANNOUNCE);
    expect(recovery.frameReceived(GAME_STATE)).toBe(SEAT_RECOVERY_OUTCOME.resynced);
    // Decided once: the next frame is traffic again.
    expect(recovery.frameReceived(LOBBY_UPDATE)).toBe(SEAT_RECOVERY_OUTCOME.none);
  });

  it('calls the seat lost when the server answers the reopen without the room', () => {
    const recovery = new SeatRecovery();
    recovery.socketDropped(true);
    recovery.socketReopened(true);
    expect(recovery.frameReceived(LOBBY_UPDATE)).toBe(SEAT_RECOVERY_OUTCOME.seatLost);
  });

  it('calls the seat lost at once when a dropped round has nothing to re-announce, since no frame would decide', () => {
    const recovery = new SeatRecovery();
    recovery.socketDropped(true);
    expect(recovery.socketReopened(false)).toEqual({ shouldReannounce: false, isSeatLost: true });
    expect(recovery.frameReceived(GAME_STATE)).toBe(SEAT_RECOVERY_OUTCOME.none);
  });

  it('re-announces after a drop in the lobby, where there is no seat to decide', () => {
    const recovery = new SeatRecovery();
    recovery.socketDropped(false);
    expect(recovery.socketReopened(true)).toEqual(REANNOUNCE);
    expect(recovery.frameReceived(LOBBY_UPDATE)).toBe(SEAT_RECOVERY_OUTCOME.none);
    expect(recovery.socketReopened(true)).toEqual(NOTHING_TO_DO);
  });

  it('ignores frames while the socket is still down', () => {
    const recovery = new SeatRecovery();
    recovery.socketDropped(true);
    expect(recovery.frameReceived(LOBBY_UPDATE)).toBe(SEAT_RECOVERY_OUTCOME.none);
  });

  it('forgets a pending seat when the player leaves, but still re-announces a socket that is down', () => {
    const recovery = new SeatRecovery();
    recovery.socketDropped(true);
    recovery.cancel();
    expect(recovery.socketReopened(true)).toEqual(REANNOUNCE);
    expect(recovery.frameReceived(LOBBY_UPDATE)).toBe(SEAT_RECOVERY_OUTCOME.none);
  });

  it('forgets a seat awaiting its first frame when the player leaves', () => {
    const recovery = new SeatRecovery();
    recovery.socketDropped(true);
    recovery.socketReopened(true);
    recovery.cancel();
    expect(recovery.frameReceived(LOBBY_UPDATE)).toBe(SEAT_RECOVERY_OUTCOME.none);
  });
});
