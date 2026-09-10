import { describe, expect, it } from 'vitest';
import {
  AVATAR_INDEX_MAX,
  AVATAR_INDEX_MIN,
  CLIENT_MESSAGE_TYPE,
  GAME_MODE,
  GAME_NAME_MAX_LENGTH,
  GAME_NAME_MIN_LENGTH,
  MAX_PLAYERS_PER_GAME,
  MIN_PLAYERS_PER_GAME,
  PLAYER_NAME_MAX_LENGTH,
  PLAYER_NAME_MIN_LENGTH,
  ROUND_DURATION_MAX_SECONDS,
  ROUND_DURATION_MIN_SECONDS,
  SEED_MAX,
  TRAIT_DRAFT_SIZE,
  createTestGameInput,
  createTestSessionConfig,
} from '@evolution/shared';
import { clientMessageSchema } from './message-schemas.js';

// Every bound below is read from `@evolution/shared`, so a literal creeping back into the
// schema (docs/CODE-STANDARDS.md §2) fails here rather than in a generic "invalid schema" test.

function joinLobby(playerName: string, avatarIndex: number): unknown {
  return { type: CLIENT_MESSAGE_TYPE.joinLobby, playerName, avatarIndex };
}

function createGame(config: Record<string, unknown>, gameName = 'dish'): unknown {
  return { type: CLIENT_MESSAGE_TYPE.createGame, gameName, config: { ...createTestSessionConfig(), ...config } };
}

function playerInput(payload: Record<string, unknown>): unknown {
  return { type: CLIENT_MESSAGE_TYPE.playerInput, payload: { ...createTestGameInput(), ...payload } };
}

function isAccepted(message: unknown): boolean {
  return clientMessageSchema.safeParse(message).success;
}

describe('clientMessageSchema: lobby bounds', () => {
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

  it('accepts a game name exactly at the maximum length and rejects one past either end', () => {
    expect(isAccepted(createGame({}, 'g'.repeat(GAME_NAME_MAX_LENGTH)))).toBe(true);
    expect(isAccepted(createGame({}, 'g'.repeat(GAME_NAME_MAX_LENGTH + 1)))).toBe(false);
    expect(isAccepted(createGame({}, 'g'.repeat(GAME_NAME_MIN_LENGTH - 1)))).toBe(false);
  });

  it('rejects an empty game id', () => {
    expect(isAccepted({ type: CLIENT_MESSAGE_TYPE.joinGame, gameId: '' })).toBe(false);
    expect(isAccepted({ type: CLIENT_MESSAGE_TYPE.joinGame, gameId: 'g1' })).toBe(true);
  });
});

describe('clientMessageSchema: GameSessionConfig', () => {
  it('accepts the player-count bounds and rejects one past either end', () => {
    expect(isAccepted(createGame({ maxPlayers: MIN_PLAYERS_PER_GAME }))).toBe(true);
    expect(isAccepted(createGame({ maxPlayers: MAX_PLAYERS_PER_GAME }))).toBe(true);
    expect(isAccepted(createGame({ maxPlayers: MAX_PLAYERS_PER_GAME + 1 }))).toBe(false);
    expect(isAccepted(createGame({ maxPlayers: MIN_PLAYERS_PER_GAME - 1 }))).toBe(false);
  });

  it('accepts a seed from 0 to SEED_MAX and rejects one past either end or fractional', () => {
    expect(isAccepted(createGame({ seed: 0 }))).toBe(true);
    expect(isAccepted(createGame({ seed: SEED_MAX }))).toBe(true);
    expect(isAccepted(createGame({ seed: SEED_MAX + 1 }))).toBe(false);
    expect(isAccepted(createGame({ seed: -1 }))).toBe(false);
    expect(isAccepted(createGame({ seed: 1.5 }))).toBe(false);
  });

  it('accepts the round-duration bounds and rejects one past either end', () => {
    expect(isAccepted(createGame({ roundDurationSeconds: ROUND_DURATION_MIN_SECONDS }))).toBe(true);
    expect(isAccepted(createGame({ roundDurationSeconds: ROUND_DURATION_MAX_SECONDS }))).toBe(true);
    expect(isAccepted(createGame({ roundDurationSeconds: ROUND_DURATION_MAX_SECONDS + 1 }))).toBe(false);
    expect(isAccepted(createGame({ roundDurationSeconds: ROUND_DURATION_MIN_SECONDS - 1 }))).toBe(false);
  });

  it('rejects the reserved colony mode and any end condition but the timer', () => {
    expect(isAccepted(createGame({ mode: GAME_MODE.freeForAll }))).toBe(true);
    expect(isAccepted(createGame({ mode: GAME_MODE.colony }))).toBe(false);
    expect(isAccepted(createGame({ endCondition: 'dominant_organism' }))).toBe(false);
  });

  it('requires every field: the server never fills a default', () => {
    for (const field of ['maxPlayers', 'seed', 'mode', 'roundDurationSeconds', 'endCondition']) {
      const config: Record<string, unknown> = { ...createTestSessionConfig() };
      delete config[field];
      expect(isAccepted({ type: CLIENT_MESSAGE_TYPE.createGame, gameName: 'dish', config }), field).toBe(false);
    }
  });
});

describe('clientMessageSchema: GameInput', () => {
  it('accepts a minimal input and one carrying every optional flag', () => {
    expect(isAccepted(playerInput({}))).toBe(true);
    expect(
      isAccepted(playerInput({ shouldSplit: true, shouldEject: false, traitChoice: { offerId: 1, cardIndex: 0 } })),
    ).toBe(true);
  });

  it('rejects a negative or fractional sequence', () => {
    expect(isAccepted(playerInput({ sequence: -1 }))).toBe(false);
    expect(isAccepted(playerInput({ sequence: 0.5 }))).toBe(false);
  });

  it('rejects a non-finite target', () => {
    expect(isAccepted(playerInput({ targetX: Number.POSITIVE_INFINITY }))).toBe(false);
    expect(isAccepted(playerInput({ targetY: Number.NaN }))).toBe(false);
  });

  it('bounds the card index by the draft size', () => {
    expect(isAccepted(playerInput({ traitChoice: { offerId: 1, cardIndex: TRAIT_DRAFT_SIZE - 1 } }))).toBe(true);
    expect(isAccepted(playerInput({ traitChoice: { offerId: 1, cardIndex: TRAIT_DRAFT_SIZE } }))).toBe(false);
    expect(isAccepted(playerInput({ traitChoice: { offerId: 1, cardIndex: -1 } }))).toBe(false);
  });

  it('rejects the template echo payloads: an input is not an arbitrary object', () => {
    expect(isAccepted({ type: CLIENT_MESSAGE_TYPE.playerInput, payload: { anything: [1, 2, 3] } })).toBe(false);
    expect(isAccepted(playerInput({ shouldSprint: 'yes' }))).toBe(false);
  });
});
