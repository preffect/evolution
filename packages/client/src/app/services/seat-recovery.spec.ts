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

describe('SeatRecovery', () => {
  it('decides nothing without a drop: every frame is ordinary traffic', () => {
    const recovery = new SeatRecovery();
    expect(recovery.socketReopened()).toBe(false);
    expect(recovery.frameReceived(LOBBY_UPDATE)).toBe(SEAT_RECOVERY_OUTCOME.none);
  });

  it('resyncs when the first frame after a mid-round reopen is the room’s game_state', () => {
    const recovery = new SeatRecovery();
    recovery.socketDropped(true);
    expect(recovery.socketReopened()).toBe(true);
    expect(recovery.frameReceived(GAME_STATE)).toBe(SEAT_RECOVERY_OUTCOME.resynced);
    // Decided once: the next frame is traffic again.
    expect(recovery.frameReceived(LOBBY_UPDATE)).toBe(SEAT_RECOVERY_OUTCOME.none);
  });

  it('calls the seat lost when the server answers the reopen without the room', () => {
    const recovery = new SeatRecovery();
    recovery.socketDropped(true);
    recovery.socketReopened();
    expect(recovery.frameReceived(LOBBY_UPDATE)).toBe(SEAT_RECOVERY_OUTCOME.seatLost);
  });

  it('ignores frames while the socket is still down, and a second reopen with nothing pending', () => {
    const recovery = new SeatRecovery();
    recovery.socketDropped(true);
    expect(recovery.frameReceived(LOBBY_UPDATE)).toBe(SEAT_RECOVERY_OUTCOME.none);
    recovery.socketReopened();
    expect(recovery.socketReopened()).toBe(false);
  });

  it('has no seat to wait for after a drop in the lobby', () => {
    const recovery = new SeatRecovery();
    recovery.socketDropped(false);
    expect(recovery.socketReopened()).toBe(false);
  });

  it('forgets a pending seat when the user leaves', () => {
    const recovery = new SeatRecovery();
    recovery.socketDropped(true);
    recovery.cancel();
    expect(recovery.socketReopened()).toBe(false);
    expect(recovery.frameReceived(LOBBY_UPDATE)).toBe(SEAT_RECOVERY_OUTCOME.none);
  });
});
