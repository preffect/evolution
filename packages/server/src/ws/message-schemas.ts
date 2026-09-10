import { z } from 'zod';
import {
  AVATAR_INDEX_MAX,
  AVATAR_INDEX_MIN,
  CLIENT_MESSAGE_TYPE,
  GAME_NAME_MAX_LENGTH,
  GAME_NAME_MIN_LENGTH,
  MAX_PLAYERS_PER_GAME,
  MIN_PLAYERS_PER_GAME,
  PLAYER_NAME_MAX_LENGTH,
  PLAYER_NAME_MIN_LENGTH,
} from '@evolution/shared';

/**
 * Inbound message validation. Lobby/perf verbs are fully validated; the single
 * gameplay verb's payload is `z.unknown()` because this is LOCAL-ONLY play and
 * we trust the client wholesale (no anti-cheat). The init step replaces the
 * payload schema with the real game input shape (docs/ARCHITECTURE.md §4).
 * Every bound comes from `@evolution/shared` constants — never a literal here.
 */

const playerNameSchema = z.string().min(PLAYER_NAME_MIN_LENGTH).max(PLAYER_NAME_MAX_LENGTH);
const avatarIndexSchema = z.number().int().min(AVATAR_INDEX_MIN).max(AVATAR_INDEX_MAX);
const gameIdSchema = z.string().min(1);

const joinLobbySchema = z.object({
  type: z.literal(CLIENT_MESSAGE_TYPE.joinLobby),
  playerName: playerNameSchema,
  avatarIndex: avatarIndexSchema,
});

const updatePlayerInfoSchema = z.object({
  type: z.literal(CLIENT_MESSAGE_TYPE.updatePlayerInfo),
  playerName: playerNameSchema,
  avatarIndex: avatarIndexSchema,
});

const createGameSchema = z.object({
  type: z.literal(CLIENT_MESSAGE_TYPE.createGame),
  gameName: z.string().min(GAME_NAME_MIN_LENGTH).max(GAME_NAME_MAX_LENGTH),
  config: z
    .object({
      maxPlayers: z.number().int().min(MIN_PLAYERS_PER_GAME).max(MAX_PLAYERS_PER_GAME),
      // TODO(game): add game-specific session config fields here.
    })
    .passthrough(),
});

const joinGameSchema = z.object({ type: z.literal(CLIENT_MESSAGE_TYPE.joinGame), gameId: gameIdSchema });
const startGameSchema = z.object({ type: z.literal(CLIENT_MESSAGE_TYPE.startGame), gameId: gameIdSchema });
const deleteGameSchema = z.object({ type: z.literal(CLIENT_MESSAGE_TYPE.deleteGame), gameId: gameIdSchema });

// TODO(game): replace z.unknown() with your validated input schema (local-only: trusting client).
const playerInputSchema = z.object({
  type: z.literal(CLIENT_MESSAGE_TYPE.playerInput),
  payload: z.unknown(),
});

const clientPerformanceSchema = z.object({
  type: z.literal(CLIENT_MESSAGE_TYPE.clientPerformance),
  report: z.object({
    fps: z.number(),
    frameTimeAvgMs: z.number(),
    frameTimeP95Ms: z.number(),
    frameTimePeakMs: z.number(),
    heapMb: z.number().nullable(),
  }),
});

export const clientMessageSchema = z.discriminatedUnion('type', [
  joinLobbySchema,
  updatePlayerInfoSchema,
  createGameSchema,
  joinGameSchema,
  startGameSchema,
  deleteGameSchema,
  playerInputSchema,
  clientPerformanceSchema,
]);

export type ValidatedClientMessage = z.infer<typeof clientMessageSchema>;
