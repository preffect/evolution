import type { PlayerId, GameId, GameSnapshot, GameInput, GameSessionConfig } from '@evolution/shared';
import type { ClientPerformanceReport } from '@evolution/shared';
import { SERVER_MESSAGE_TYPE, TICK_INTERVAL_MS } from '@evolution/shared';
import type { Connection } from '../ws/connection.js';
import { broadcastMessage, sendMessage } from '../ws/connection.js';
import { PerformanceTracker } from './performance-tracker.js';
import type { GameModule, RoomInitOptions } from '../game/game-module.js';

/**
 * A running game session. Owns the connections, the late-join/disconnect
 * bookkeeping, the fixed-tick loop and perf telemetry. All game-specific guts
 * live behind the injected `GameModule` (the 3 tick hooks + add/removePlayer).
 */
export class GameRoom {
  readonly playerConnections = new Map<string, Connection>();
  readonly disconnectedPlayers = new Set<string>();
  readonly allPlayerIds: string[];
  readonly creatorId: PlayerId;
  readonly gameName: string;
  readonly sessionConfig: GameSessionConfig;
  readonly avatarAssignments: Record<string, number>;
  readonly playerNames: Record<string, string>;
  readonly performanceTracker = new PerformanceTracker();

  private readonly game: GameModule;
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  constructor(game: GameModule, options: RoomInitOptions) {
    this.game = game;
    this.creatorId = options.creatorId;
    this.allPlayerIds = [...options.playerIds];
    this.gameName = options.gameName;
    this.sessionConfig = options.config;
    this.avatarAssignments = { ...options.avatarAssignments };
    this.playerNames = { ...options.playerNames };
  }

  start(): void {
    if (!this.tickInterval) {
      this.tickInterval = setInterval(() => this.tickStep(), TICK_INTERVAL_MS);
    }
  }

  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.game.free?.();
  }

  addPlayer(connection: Connection): void {
    this.playerConnections.set(connection.playerId, connection);
  }

  reattachPlayer(connection: Connection): void {
    this.playerConnections.set(connection.playerId, connection);
    this.disconnectedPlayers.delete(connection.playerId);
  }

  submitInput(playerId: string, payload: GameInput): void {
    this.game.submitInput(playerId as PlayerId, payload);
  }

  recordClientPerformance(playerId: string, report: ClientPerformanceReport): void {
    this.performanceTracker.recordClientReport(playerId as PlayerId, report);
  }

  getSnapshot(): GameSnapshot {
    return this.game.serializeRoomState();
  }

  /** Player who was never part of the session joins an in-progress game. */
  addLatePlayer(connection: Connection, gameId: string): void {
    const playerId = connection.playerId;
    this.allPlayerIds.push(playerId);
    this.avatarAssignments[playerId] = connection.avatarIndex;
    this.playerNames[playerId] = connection.playerName;
    this.playerConnections.set(playerId, connection);
    this.game.addPlayer(playerId as PlayerId, connection.avatarIndex, connection.playerName);
    broadcastMessage(
      Array.from(this.playerConnections.values()).filter((other) => other.playerId !== playerId),
      { type: SERVER_MESSAGE_TYPE.playerJoined, playerId: playerId as PlayerId, avatarIndex: connection.avatarIndex },
    );
    sendMessage(connection, {
      type: SERVER_MESSAGE_TYPE.gameState,
      gameId: gameId as GameId,
      playerId: playerId as PlayerId,
      snapshot: this.game.serializeRoomState(),
      config: this.sessionConfig,
      playerIds: this.allPlayerIds as PlayerId[],
      avatarAssignments: this.avatarAssignments,
    });
  }

  removePlayer(playerId: string): void {
    this.playerConnections.delete(playerId);
    this.disconnectedPlayers.add(playerId);
    this.performanceTracker.removeClient(playerId as PlayerId);
    this.game.removePlayer(playerId as PlayerId);
    const index = this.allPlayerIds.indexOf(playerId);
    if (index >= 0) this.allPlayerIds.splice(index, 1);
  }

  private tickStep(): void {
    const tickStartMs = performance.now();
    this.game.reduceGameState(); // TODO(game) hook: advance one tick
    const snapshot = this.game.serializeRoomState(); // TODO(game) hook: build broadcast payload
    const bytes = broadcastMessage(this.playerConnections.values(), {
      type: SERVER_MESSAGE_TYPE.gameSnapshot,
      snapshot,
    });
    this.performanceTracker.recordTick({
      tickMs: performance.now() - tickStartMs,
      snapshotBytes: bytes,
      broadcastClients: this.playerConnections.size,
    });
  }
}
