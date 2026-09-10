import { describe, expect, it } from 'vitest';
import {
  AVATAR_INDEX_MAX,
  AVATAR_INDEX_MIN,
  CLIENT_MESSAGE_TYPE,
  GAME_NAME_MAX_LENGTH,
  MAX_PLAYERS_PER_GAME,
  MIN_PLAYERS_PER_GAME,
  PLAYER_NAME_MAX_LENGTH,
  PLAYER_NAME_MIN_LENGTH,
} from '@evolution/shared';
import { clientMessageSchema } from './message-schemas.js';

// Every bound below is read from `@evolution/shared`, so a literal creeping back into the
// schema (docs/CODE-STANDARDS.md §2) fails here rather than in a generic "invalid schema" test.

function joinLobby(playerName: string, avatarIndex: number): unknown {
  return { type: CLIENT_MESSAGE_TYPE.joinLobby, playerName, avatarIndex };
}

function createGame(maxPlayers: number, gameName = 'dish'): unknown {
  return { type: CLIENT_MESSAGE_TYPE.createGame, gameName, config: { maxPlayers } };
}

function isAccepted(message: unknown): boolean {
  return clientMessageSchema.safeParse(message).success;
}

describe('clientMessageSchema bounds', () => {
  it('accepts a player name exactly at the maximum length', () => {
    expect(isAccepted(joinLobby('a'.repeat(PLAYER_NAME_MAX_LENGTH), AVATAR_INDEX_MIN))).toBe(true);
  });

  it('rejects a player name one over the maximum length', () => {
    expect(isAccepted(joinLobby('a'.repeat(PLAYER_NAME_MAX_LENGTH + 1), AVATAR_INDEX_MIN))).toBe(false);
  });

  it('rejects a player name one under the minimum length', () => {
    expect(isAccepted(joinLobby('a'.repeat(PLAYER_NAME_MIN_LENGTH - 1), AVATAR_INDEX_MIN))).toBe(false);
  });

  it('accepts the whole avatar index range and rejects one past either end', () => {
    expect(isAccepted(joinLobby('a', AVATAR_INDEX_MIN))).toBe(true);
    expect(isAccepted(joinLobby('a', AVATAR_INDEX_MAX))).toBe(true);
    expect(isAccepted(joinLobby('a', AVATAR_INDEX_MAX + 1))).toBe(false);
    expect(isAccepted(joinLobby('a', AVATAR_INDEX_MIN - 1))).toBe(false);
  });

  it('accepts the player-count bounds and rejects one past either end', () => {
    expect(isAccepted(createGame(MIN_PLAYERS_PER_GAME))).toBe(true);
    expect(isAccepted(createGame(MAX_PLAYERS_PER_GAME))).toBe(true);
    expect(isAccepted(createGame(MAX_PLAYERS_PER_GAME + 1))).toBe(false);
    expect(isAccepted(createGame(MIN_PLAYERS_PER_GAME - 1))).toBe(false);
  });

  it('rejects a game name one over the maximum length', () => {
    expect(isAccepted(createGame(MIN_PLAYERS_PER_GAME, 'g'.repeat(GAME_NAME_MAX_LENGTH + 1)))).toBe(false);
  });

  it('rejects an empty game id', () => {
    expect(isAccepted({ type: CLIENT_MESSAGE_TYPE.joinGame, gameId: '' })).toBe(false);
    expect(isAccepted({ type: CLIENT_MESSAGE_TYPE.joinGame, gameId: 'g1' })).toBe(true);
  });
});
