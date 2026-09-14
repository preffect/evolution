import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  SERVER_MESSAGE_TYPE,
  createTestSessionConfig,
  createTestSnapshot,
  gameId,
  playerId,
} from '@evolution/shared';
import { RoomState } from './room-state';

const ROOM = gameId('room');
const OWN_PLAYER = playerId('me');
const RIVAL = playerId('rival');
const CONFIG = createTestSessionConfig({ maxPlayers: 4 });

function filledRoom(): RoomState {
  const room = new RoomState();
  room.applyGameStarted({
    type: SERVER_MESSAGE_TYPE.gameStarted,
    gameId: ROOM,
    playerId: OWN_PLAYER,
    playerIds: [OWN_PLAYER],
    isHost: true,
    config: CONFIG,
  });
  room.applyGameState({
    type: SERVER_MESSAGE_TYPE.gameState,
    gameId: ROOM,
    playerId: OWN_PLAYER,
    snapshot: createTestSnapshot({ tick: 4 }),
    balance: DEFAULT_BALANCE,
    config: CONFIG,
    playerIds: [OWN_PLAYER, RIVAL],
    avatarAssignments: { me: 0, rival: 1 },
  });
  return room;
}

describe('RoomState', () => {
  it('starts empty', () => {
    const room = new RoomState();
    expect(room.gameId()).toBeNull();
    expect(room.playerIds()).toEqual([]);
    expect(room.snapshot()).toBeNull();
  });

  it('takes the seat and the host flag from game_started, then the whole view from game_state', () => {
    const room = filledRoom();
    expect(room.isHost()).toBe(true);
    expect(room.gameId()).toBe(ROOM);
    expect(room.playerId()).toBe(OWN_PLAYER);
    expect(room.playerIds()).toEqual([OWN_PLAYER, RIVAL]);
    expect(room.sessionConfig()).toEqual(CONFIG);
    expect(room.avatarAssignments()).toEqual({ me: 0, rival: 1 });
    expect(room.balance()).toBe(DEFAULT_BALANCE);
    expect(room.snapshot()?.tick).toBe(4);
  });

  it('clears every fact on leaving, so the next room inherits nothing', () => {
    const room = filledRoom();
    room.clear();
    expect(room.playerId()).toBeNull();
    expect(room.gameId()).toBeNull();
    expect(room.playerIds()).toEqual([]);
    expect(room.isHost()).toBe(false);
    expect(room.avatarAssignments()).toEqual({});
    expect(room.sessionConfig()).toBeNull();
    expect(room.snapshot()).toBeNull();
    expect(room.balance()).toBeNull();
  });
});
