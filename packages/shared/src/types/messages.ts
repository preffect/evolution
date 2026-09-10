// Generic client <-> server message envelope (the wire contract).
//
// The transport, lobby, room lifecycle and MCP plumbing are all game-agnostic.
// The ONLY game-defined seams here are `GameInput`, `GameSnapshot` and
// `GameSessionConfig` — every other field is generic infrastructure.

import type { PlayerId, GameId } from './common.js';

// ===== Opaque game-defined types. TODO(init): replace `unknown`. =====
/** TODO(game): replace with your game's validated per-tick/turn input shape. */
export type GameInput = unknown;
/** TODO(game): replace with your game's broadcast snapshot shape. */
export type GameSnapshot = unknown;
/** TODO(game): replace with your game's session config (seed, mode, etc.). */
export interface GameSessionConfig {
  maxPlayers: number;
  // TODO(game): add game-specific session config fields here.
}

// ===== Generic lobby / player descriptors =====
export interface LobbyPlayerInfo {
  playerId: PlayerId;
  playerName: string;
  avatarIndex: number;
}

export interface LobbyGameInfo {
  gameId: GameId;
  gameName: string;
  players: LobbyPlayerInfo[];
  maxPlayers: number;
  started: boolean;
  creatorId: PlayerId;
}

export interface ClientPerformanceReport {
  fps: number;
  frameTimeAvgMs: number;
  frameTimeP95Ms: number;
  frameTimePeakMs: number;
  heapMb: number | null;
}

// ===== Generic room / lobby view models =====
// Game-agnostic snapshots of server-side state, suitable for MCP/debug views
// and client lobby rendering. The `started` flag is the room lifecycle marker;
// `LobbyGameInfo` (above) is the trimmed form sent over the wire in `lobby_update`.
export interface RoomState {
  gameId: GameId;
  gameName: string;
  creatorId: PlayerId;
  maxPlayers: number;
  started: boolean;
  /** Players currently connected to the room. */
  connectedPlayerIds: PlayerId[];
  /** Players in a disconnect grace window (may reattach before removal). */
  disconnectedPlayerIds: PlayerId[];
  /** Every player ever in the room, in join order. */
  allPlayerIds: PlayerId[];
}

export interface LobbyState {
  /** Active (started) rooms. */
  rooms: RoomState[];
  /** Pending (not-yet-started) games awaiting players. */
  pending: LobbyGameInfo[];
}

// ===== Message type ids =====
// The wire verbs live here as `as const` objects (docs/CODE-STANDARDS.md §2);
// schemas, routers and clients import them instead of repeating string literals.
export const CLIENT_MESSAGE_TYPE = {
  joinLobby: 'join_lobby',
  updatePlayerInfo: 'update_player_info',
  createGame: 'create_game',
  joinGame: 'join_game',
  startGame: 'start_game',
  deleteGame: 'delete_game',
  playerInput: 'player_input',
  clientPerformance: 'client_performance',
  // TODO(game): add game-specific client message verbs here.
} as const;

export const SERVER_MESSAGE_TYPE = {
  lobbyUpdate: 'lobby_update',
  gameStarted: 'game_started',
  gameState: 'game_state',
  gameSnapshot: 'game_snapshot',
  playerJoined: 'player_joined',
  playerDisconnected: 'player_disconnected',
  error: 'error',
  // TODO(game): add game-specific server message verbs here.
} as const;

// ===== Client -> Server =====
export type ClientMessage =
  | { type: typeof CLIENT_MESSAGE_TYPE.joinLobby; playerName: string; avatarIndex: number }
  | { type: typeof CLIENT_MESSAGE_TYPE.updatePlayerInfo; playerName: string; avatarIndex: number }
  | { type: typeof CLIENT_MESSAGE_TYPE.createGame; gameName: string; config: GameSessionConfig }
  | { type: typeof CLIENT_MESSAGE_TYPE.joinGame; gameId: string }
  | { type: typeof CLIENT_MESSAGE_TYPE.startGame; gameId: string }
  | { type: typeof CLIENT_MESSAGE_TYPE.deleteGame; gameId: string }
  | { type: typeof CLIENT_MESSAGE_TYPE.playerInput; payload: GameInput } // TODO(game): typed input
  | { type: typeof CLIENT_MESSAGE_TYPE.clientPerformance; report: ClientPerformanceReport };
// TODO(game): add game-specific client message variants here.

// ===== Server -> Client =====
export type ServerMessage =
  | { type: typeof SERVER_MESSAGE_TYPE.lobbyUpdate; games: LobbyGameInfo[] }
  | {
      type: typeof SERVER_MESSAGE_TYPE.gameStarted;
      gameId: GameId;
      playerId: PlayerId;
      playerIds: PlayerId[];
      isHost: boolean;
      config: GameSessionConfig;
    }
  | {
      type: typeof SERVER_MESSAGE_TYPE.gameState;
      gameId: GameId;
      playerId: PlayerId;
      snapshot: GameSnapshot;
      config: GameSessionConfig;
      playerIds: PlayerId[];
      avatarAssignments: Record<string, number>;
    }
  | { type: typeof SERVER_MESSAGE_TYPE.gameSnapshot; snapshot: GameSnapshot }
  | { type: typeof SERVER_MESSAGE_TYPE.playerJoined; playerId: PlayerId; avatarIndex: number }
  | { type: typeof SERVER_MESSAGE_TYPE.playerDisconnected; playerId: PlayerId }
  | { type: typeof SERVER_MESSAGE_TYPE.error; message: string };
// TODO(game): add game-specific server message variants here.

// Convenience unions for exhaustive handling.
export type ClientMessageType = ClientMessage['type'];
export type ServerMessageType = ServerMessage['type'];
