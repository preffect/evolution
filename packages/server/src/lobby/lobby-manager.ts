import { nanoid } from 'nanoid';
import type { PlayerId, GameId, LobbyGameInfo, GameSessionConfig } from '@evolution/shared';
import { GAME_ID_LENGTH, SERVER_MESSAGE_TYPE } from '@evolution/shared';
import type { Connection } from '../ws/connection.js';
import { broadcastMessage, sendMessage } from '../ws/connection.js';
import type { MessageHandlers } from '../ws/message-router.js';
import { GameRoom } from './game-room.js';
import type { RoomTimingFactory } from './room-timing.js';
import type { GameModuleFactory, RoomInitOptions } from '../game/game-module.js';
import { lobbyPresenceOf, roomInitOptionsOf, type PendingGame } from './pending-game.js';
import { SeatLifecycle } from './seat-lifecycle.js';

const GAME_NOT_FOUND = 'Game not found';
const ONLY_CREATOR_MAY_DELETE = 'Only the creator can delete the game';

/**
 * Generic lobby + room lifecycle. Owns pending games, active rooms, the player->game index and lobby
 * broadcasting; how a seat is freed (disconnect grace, `leave_game`, a seat taken elsewhere) is the
 * `SeatLifecycle`'s. Game logic is injected via a `GameModuleFactory` (the ONLY game seam here) and
 * room time via a `RoomTimingFactory` (docs/determinism/contract-and-clock.md §2): only the
 * composition root names the production clock and ticker.
 */
export class LobbyManager {
  private readonly pendingGames = new Map<string, PendingGame>();
  private readonly activeRooms = new Map<string, GameRoom>();
  private readonly playerToGame = new Map<string, string>();
  private readonly seats = new SeatLifecycle(
    { pendingGames: this.pendingGames, activeRooms: this.activeRooms, playerToGame: this.playerToGame },
    () => this.broadcastLobbyUpdate(),
  );
  /** The shared connections registry (set when handlers are created). */
  private connections: Map<string, Connection> = new Map();

  constructor(
    private readonly gameFactory: GameModuleFactory,
    private readonly createRoomTiming: RoomTimingFactory,
  ) {}

  createHandlers(connections: Map<string, Connection>): MessageHandlers {
    this.connections = connections;
    return {
      onJoinLobby: (connection, message) => this.onJoinLobby(connection, message.playerName, message.avatarIndex),
      onUpdatePlayerInfo: (connection, message) =>
        this.onUpdatePlayerInfo(connection, message.playerName, message.avatarIndex),
      onCreateGame: (connection, message) => this.onCreateGame(connection, message.gameName, message.config),
      onJoinGame: (connection, message) => this.onJoinGame(connection, message.gameId),
      onStartGame: (connection, message) => this.onStartGame(connection, message.gameId),
      onDeleteGame: (connection, message) => this.onDeleteGame(connection, message.gameId),
      onLeaveGame: (connection, message) => this.seats.leave(connection.playerId, message.gameId),
      onPlayerInput: (connection, message) => {
        this.roomOfPlayer(connection)?.submitInput(connection.playerId, message.payload);
      },
      onClientPerformance: (connection, message) => {
        this.roomOfPlayer(connection)?.recordClientPerformance(connection.playerId, message.report);
      },
      onSnapshotAck: (connection, message) => {
        this.roomOfPlayer(connection)?.recordSnapshotAck(connection.playerId, message.tick);
      },
    };
  }

  // ---- lobby verbs -------------------------------------------------------

  private onJoinLobby(connection: Connection, playerName: string, avatarIndex: number): void {
    connection.playerName = playerName;
    connection.avatarIndex = avatarIndex;
    sendMessage(connection, { type: SERVER_MESSAGE_TYPE.lobbyUpdate, games: this.listGames() });
  }

  private onUpdatePlayerInfo(connection: Connection, playerName: string, avatarIndex: number): void {
    connection.playerName = playerName;
    connection.avatarIndex = avatarIndex;
    // Reflect the change in any pending game the player has joined.
    const gameId = this.playerToGame.get(connection.playerId);
    if (gameId) {
      this.pendingGames.get(gameId)?.players.set(connection.playerId, lobbyPresenceOf(connection));
    }
    this.broadcastLobbyUpdate();
  }

  private onCreateGame(connection: Connection, gameName: string, config: GameSessionConfig): void {
    const gameId = nanoid(GAME_ID_LENGTH);
    this.seats.leaveOtherSeat(connection.playerId, gameId);
    const pending: PendingGame = {
      gameId,
      gameName,
      creatorId: connection.playerId,
      config,
      players: new Map([[connection.playerId, lobbyPresenceOf(connection)]]),
    };
    this.pendingGames.set(gameId, pending);
    this.playerToGame.set(connection.playerId, gameId);
    this.broadcastLobbyUpdate();
  }

  /** A seat held in another room is left only once the join is accepted (#334), so a refused join keeps it. */
  private onJoinGame(connection: Connection, gameId: string): void {
    // Joining an in-progress game = late join.
    const active = this.activeRooms.get(gameId);
    if (active) {
      this.seats.leaveOtherSeat(connection.playerId, gameId);
      this.playerToGame.set(connection.playerId, gameId);
      active.addLatePlayer(connection);
      this.broadcastLobbyUpdate();
      return;
    }

    const pending = this.pendingGameOrReject(connection, gameId);
    if (!pending) return;
    if (pending.players.size >= pending.config.maxPlayers) {
      sendMessage(connection, { type: SERVER_MESSAGE_TYPE.error, message: 'Game is full' });
      return;
    }
    this.seats.leaveOtherSeat(connection.playerId, gameId);
    pending.players.set(connection.playerId, lobbyPresenceOf(connection));
    this.playerToGame.set(connection.playerId, gameId);
    this.broadcastLobbyUpdate();
  }

  private onStartGame(connection: Connection, gameId: string): void {
    const pending = this.pendingGameOrReject(connection, gameId);
    if (!pending) return;
    if (pending.creatorId !== connection.playerId) {
      sendMessage(connection, { type: SERVER_MESSAGE_TYPE.error, message: 'Only the creator can start the game' });
      return;
    }

    const options = roomInitOptionsOf(pending);
    const room = new GameRoom(this.gameFactory(options), options, this.createRoomTiming());
    for (const playerId of options.playerIds) {
      const playerConnection = this.connections.get(playerId);
      if (playerConnection) room.addPlayer(playerConnection);
    }
    this.notifyGameStarted(gameId, room, options);

    this.pendingGames.delete(gameId);
    this.activeRooms.set(gameId, room);
    room.start();
    this.broadcastLobbyUpdate();
  }

  /** Each player hears `game_started`, then the full `game_state` it builds its view from (docs/architecture/wire-contract.md §4). */
  private notifyGameStarted(gameId: string, room: GameRoom, options: RoomInitOptions): void {
    for (const playerId of options.playerIds) {
      const playerConnection = this.connections.get(playerId);
      if (!playerConnection) continue;
      sendMessage(playerConnection, {
        type: SERVER_MESSAGE_TYPE.gameStarted,
        gameId: gameId as GameId,
        playerId,
        playerIds: options.playerIds,
        isHost: playerId === options.creatorId,
        config: options.config,
      });
      sendMessage(playerConnection, room.gameStateMessageFor(playerId));
    }
  }

  private onDeleteGame(connection: Connection, gameId: string): void {
    const pending = this.pendingGames.get(gameId);
    if (pending) {
      if (pending.creatorId !== connection.playerId) {
        sendMessage(connection, { type: SERVER_MESSAGE_TYPE.error, message: ONLY_CREATOR_MAY_DELETE });
        return;
      }
      for (const playerId of pending.players.keys()) this.playerToGame.delete(playerId);
      this.pendingGames.delete(gameId);
      this.broadcastLobbyUpdate();
      return;
    }
    const active = this.activeRooms.get(gameId);
    if (active) {
      if (active.creatorId !== connection.playerId) {
        sendMessage(connection, { type: SERVER_MESSAGE_TYPE.error, message: ONLY_CREATOR_MAY_DELETE });
        return;
      }
      this.seats.teardownRoom(gameId);
    }
  }

  // ---- connection lifecycle ----------------------------------------------

  handleConnect(connection: Connection, _connections: Map<string, Connection>): void {
    // The player came back within the grace window.
    this.seats.cancelPendingRemoval(connection.playerId);

    const gameId = this.playerToGame.get(connection.playerId);
    if (!gameId) return;
    const room = this.activeRooms.get(gameId);
    if (room) {
      room.reattachPlayer(connection);
      // Resend the full game state so the reconnected client can resync.
      sendMessage(connection, room.gameStateMessageFor(connection.playerId as PlayerId));
    }
  }

  handleDisconnect(connection: Connection): void {
    this.seats.dropConnection(connection.playerId);
  }

  // ---- queries (also used by MCP) ----------------------------------------

  listGames(): LobbyGameInfo[] {
    const pendingInfos = Array.from(this.pendingGames.values(), (pending) => ({
      gameId: pending.gameId as GameId,
      gameName: pending.gameName,
      players: Array.from(pending.players.values()),
      maxPlayers: pending.config.maxPlayers,
      isStarted: false,
      creatorId: pending.creatorId as PlayerId,
    }));
    const activeInfos = Array.from(this.activeRooms, ([gameId, room]) => ({
      gameId: gameId as GameId,
      gameName: room.gameName,
      players: room.allPlayerIds.map((playerId) => ({
        playerId: playerId as PlayerId,
        playerName: room.playerNames[playerId] ?? '',
        avatarIndex: room.avatarAssignments[playerId] ?? 0,
      })),
      maxPlayers: room.sessionConfig.maxPlayers,
      isStarted: true,
      creatorId: room.creatorId,
    }));
    return [...pendingInfos, ...activeInfos];
  }

  getActiveRoom(gameId: string): GameRoom | undefined {
    return this.activeRooms.get(gameId);
  }

  listActiveRooms(): ReadonlyMap<string, GameRoom> {
    return this.activeRooms;
  }

  /** Pending (not-yet-started) games keyed by gameId. Used by MCP + tests. */
  listPendingGames(): ReadonlyMap<string, PendingGame> {
    return this.pendingGames;
  }

  /** The pending game, or undefined after telling the client it does not exist. */
  private pendingGameOrReject(connection: Connection, gameId: string): PendingGame | undefined {
    const pending = this.pendingGames.get(gameId);
    if (!pending) sendMessage(connection, { type: SERVER_MESSAGE_TYPE.error, message: GAME_NOT_FOUND });
    return pending;
  }

  private roomOfPlayer(connection: Connection): GameRoom | undefined {
    const gameId = this.playerToGame.get(connection.playerId);
    return gameId ? this.activeRooms.get(gameId) : undefined;
  }

  private broadcastLobbyUpdate(): void {
    const games = this.listGames();
    broadcastMessage(this.connections.values(), { type: SERVER_MESSAGE_TYPE.lobbyUpdate, games });
  }
}
