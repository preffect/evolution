import { z } from 'zod';
import {
  AVATAR_INDEX_MAX,
  AVATAR_INDEX_MIN,
  CLIENT_MESSAGE_TYPE,
  GAME_ID_MIN_LENGTH,
  GAME_MODE,
  GAME_NAME_MAX_LENGTH,
  GAME_NAME_MIN_LENGTH,
  MAX_PLAYERS_PER_GAME,
  MIN_PLAYERS_PER_GAME,
  PLAYER_NAME_MAX_LENGTH,
  PLAYER_NAME_MIN_LENGTH,
  ROUND_DURATION_MAX_SECONDS,
  ROUND_DURATION_MIN_SECONDS,
  ROUND_END_CONDITION,
  SEED_MAX,
  RENDER_STAGE_NAMES,
  TRAIT_DRAFT_SIZE,
} from '@evolution/shared';
import type { GameInput, GameSessionConfig, RenderStageName } from '@evolution/shared';

/**
 * Inbound message validation (docs/ARCHITECTURE.md §4): every message is parsed here before a
 * handler sees it, and this is the only check inputs get (local-only play, client trusted).
 * Every bound comes from `@evolution/shared` constants, never a literal here. The reserved
 * `mode: 'colony'` and the non-timer end conditions are rejected until build 2
 * (docs/GAME-DESIGN.md §11); the reserved `shouldSplit` / `shouldEject` flags pass and are ignored.
 */

const playerNameSchema = z.string().min(PLAYER_NAME_MIN_LENGTH).max(PLAYER_NAME_MAX_LENGTH);
const avatarIndexSchema = z.number().int().min(AVATAR_INDEX_MIN).max(AVATAR_INDEX_MAX);
const gameIdSchema = z.string().min(GAME_ID_MIN_LENGTH);
const worldCoordinateSchema = z.number().finite();

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

// Annotated with the shared types so handlers receive `GameSessionConfig` / `GameInput`, not a
// narrower zod inference (`mode` is the shared union; the literal only decides what passes).
export const gameSessionConfigSchema: z.ZodType<GameSessionConfig> = z.object({
  maxPlayers: z.number().int().min(MIN_PLAYERS_PER_GAME).max(MAX_PLAYERS_PER_GAME),
  seed: z.number().int().min(0).max(SEED_MAX),
  mode: z.literal(GAME_MODE.freeForAll),
  roundDurationSeconds: z.number().int().min(ROUND_DURATION_MIN_SECONDS).max(ROUND_DURATION_MAX_SECONDS),
  endCondition: z.literal(ROUND_END_CONDITION.timer),
});

const createGameSchema = z.object({
  type: z.literal(CLIENT_MESSAGE_TYPE.createGame),
  gameName: z.string().min(GAME_NAME_MIN_LENGTH).max(GAME_NAME_MAX_LENGTH),
  config: gameSessionConfigSchema,
});

const joinGameSchema = z.object({ type: z.literal(CLIENT_MESSAGE_TYPE.joinGame), gameId: gameIdSchema });
const startGameSchema = z.object({ type: z.literal(CLIENT_MESSAGE_TYPE.startGame), gameId: gameIdSchema });
const deleteGameSchema = z.object({ type: z.literal(CLIENT_MESSAGE_TYPE.deleteGame), gameId: gameIdSchema });

const traitChoiceSchema = z.object({
  offerId: z.number().int().min(0),
  cardIndex: z
    .number()
    .int()
    .min(0)
    .max(TRAIT_DRAFT_SIZE - 1),
});

export const gameInputSchema: z.ZodType<GameInput> = z.object({
  sequence: z.number().int().min(0),
  targetX: worldCoordinateSchema,
  targetY: worldCoordinateSchema,
  shouldSprint: z.boolean(),
  traitChoice: traitChoiceSchema.nullable(),
  shouldSplit: z.boolean().optional(),
  shouldEject: z.boolean().optional(),
});

const playerInputSchema = z.object({
  type: z.literal(CLIENT_MESSAGE_TYPE.playerInput),
  payload: gameInputSchema,
});

/** Every render stage of docs/RENDERING.md §7 is required, so a client that skips one is refused here. */
const renderStagesSchema = z.object(
  Object.fromEntries(RENDER_STAGE_NAMES.map((stage) => [stage, z.number()])) as Record<RenderStageName, z.ZodNumber>,
);

const clientPerformanceSchema = z.object({
  type: z.literal(CLIENT_MESSAGE_TYPE.clientPerformance),
  report: z.object({
    fps: z.number(),
    frameTimeAvgMs: z.number(),
    frameTimeP95Ms: z.number(),
    frameTimePeakMs: z.number(),
    heapMb: z.number().nullable(),
    renderStagesMs: renderStagesSchema,
    gpuMs: z.number().nullable(),
    drawCalls: z.number(),
    visibleCells: z.number(),
    visibleMotes: z.number(),
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
