import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  SERVER_MESSAGE_TYPE,
  createTestSessionConfig,
  createTestSnapshot,
  gameId,
  playerId,
  type GameId,
  type ServerMessage,
} from '@evolution/shared';
import { LeftRoomFilter } from './left-room-filter';

const LEFT_ROOM = gameId('left');
const OTHER_ROOM = gameId('other');
const OWN_PLAYER = playerId('me');

function gameStateFor(room: GameId): ServerMessage {
  return {
    type: SERVER_MESSAGE_TYPE.gameState,
    gameId: room,
    playerId: OWN_PLAYER,
    snapshot: createTestSnapshot(),
    balance: DEFAULT_BALANCE,
    config: createTestSessionConfig(),
    playerIds: [OWN_PLAYER],
    avatarAssignments: {},
  };
}

const ROOM_FRAMES_WITHOUT_ID: readonly ServerMessage[] = [
  { type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot: createTestSnapshot() },
  { type: SERVER_MESSAGE_TYPE.balanceUpdated, balance: DEFAULT_BALANCE },
  { type: SERVER_MESSAGE_TYPE.playerJoined, playerId: OWN_PLAYER, avatarIndex: 1 },
  { type: SERVER_MESSAGE_TYPE.playerDisconnected, playerId: OWN_PLAYER },
];

function filterThatLeft(): LeftRoomFilter {
  const filter = new LeftRoomFilter();
  filter.left(LEFT_ROOM);
  return filter;
}

describe('LeftRoomFilter', () => {
  it('admits everything before a room is left, and after leaving a room that was never named', () => {
    const filter = new LeftRoomFilter();
    expect(filter.admits(gameStateFor(LEFT_ROOM))).toBe(true);
    filter.left(null);
    expect(ROOM_FRAMES_WITHOUT_ID.every((message) => filter.admits(message))).toBe(true);
  });

  it('drops the left room’s game_state and every room frame that carries no room id', () => {
    const filter = filterThatLeft();
    expect(filter.admits(gameStateFor(LEFT_ROOM))).toBe(false);
    for (const message of ROOM_FRAMES_WITHOUT_ID) expect(filter.admits(message)).toBe(false);
  });

  it('keeps lobby traffic and errors flowing', () => {
    const filter = filterThatLeft();
    expect(filter.admits({ type: SERVER_MESSAGE_TYPE.lobbyUpdate, games: [] })).toBe(true);
    expect(filter.admits({ type: SERVER_MESSAGE_TYPE.error, message: 'nope' })).toBe(true);
  });

  it('ends on a game_started, so the next room’s frames arrive', () => {
    const filter = filterThatLeft();
    const started: ServerMessage = {
      type: SERVER_MESSAGE_TYPE.gameStarted,
      gameId: OTHER_ROOM,
      playerId: OWN_PLAYER,
      playerIds: [OWN_PLAYER],
      isHost: true,
      config: createTestSessionConfig(),
    };
    expect(filter.admits(started)).toBe(true);
    expect(filter.admits(ROOM_FRAMES_WITHOUT_ID[0]!)).toBe(true);
  });

  it('ends on a game_state for another room', () => {
    const filter = filterThatLeft();
    expect(filter.admits(gameStateFor(OTHER_ROOM))).toBe(true);
    expect(filter.admits(gameStateFor(LEFT_ROOM))).toBe(true);
  });

  it('ends when the player asks for a room again', () => {
    const filter = filterThatLeft();
    filter.forget();
    expect(filter.admits(gameStateFor(LEFT_ROOM))).toBe(true);
  });
});
