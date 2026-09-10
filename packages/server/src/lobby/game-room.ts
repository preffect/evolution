import type { PlayerId, GameId, GameSnapshot, GameInput, GameSessionConfig } from '@evolution/shared';
import type { ClientPerformanceReport } from '@evolution/shared';
import { SERVER_MESSAGE_TYPE, createSimulationStepAccumulator } from '@evolution/shared';
import type { Connection } from '../ws/connection.js';
import { broadcastMessage, sendMessage } from '../ws/connection.js';
import { PerformanceTracker } from './performance-tracker.js';
import type { RoomTiming } from './room-timing.js';
import type { GameModule, RoomInitOptions } from '../game/game-module.js';
import type { SimulationDebugHandle } from '../game/debug/simulation-debug-handle.js';

/**
 * A running game session. Owns the connections, the late-join/disconnect
 * bookkeeping, the fixed-tick loop and perf telemetry. All game-specific guts
 * live behind the injected `GameModule` (the 3 tick hooks + add/removePlayer).
 *
 * Time flows in through `RoomTiming` only (docs/DETERMINISM.md §2): the ticker wakes the loop,
 * the accumulator turns the clock into whole ticks, and the debug tools can pause the loop and
 * step it by hand for deterministic screenshots (docs/ARCHITECTURE.md §8).
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
  private readonly timing: RoomTiming;
  private readonly accumulator;
  private isLoopPaused = false;
  private isLoopStarted = false;
  private tickCount = 0;

  constructor(game: GameModule, options: RoomInitOptions, timing: RoomTiming) {
    this.game = game;
    this.timing = timing;
    this.accumulator = createSimulationStepAccumulator(timing.clock);
    this.creatorId = options.creatorId;
    this.allPlayerIds = [...options.playerIds];
    this.gameName = options.gameName;
    this.sessionConfig = options.config;
    this.avatarAssignments = { ...options.avatarAssignments };
    this.playerNames = { ...options.playerNames };
  }

  start(): void {
    if (this.isLoopStarted) return;
    this.isLoopStarted = true;
    this.timing.ticker.start(() => this.onTickerFire());
  }

  stop(): void {
    if (this.isLoopStarted) {
      this.timing.ticker.stop();
      this.isLoopStarted = false;
    }
    this.game.free?.();
  }

  // ---- debug loop control (docs/ARCHITECTURE.md §8) ----------------------

  /** Ticks stepped since the room started; the room's own clock for modules without a world tick. */
  getTickCount(): number {
    return this.tickCount;
  }

  isPaused(): boolean {
    return this.isLoopPaused;
  }

  /** Freezes the loop: ticker fires are ignored until `resume()`. */
  pause(): void {
    this.isLoopPaused = true;
  }

  /** Pauses the loop if it is running, then advances exactly `ticks` steps, broadcasting each. */
  step(ticks: number): void {
    this.isLoopPaused = true;
    for (let count = 0; count < ticks; count += 1) this.runTick();
  }

  /** Unfreezes the loop. The wall time that passed while paused is discarded, never caught up. */
  resume(): void {
    this.isLoopPaused = false;
    this.accumulator.dueTicks();
    this.accumulator.takeDroppedTicks();
  }

  getDebugHandle(): SimulationDebugHandle | undefined {
    return this.game.getDebugHandle?.();
  }

  // ---- membership --------------------------------------------------------

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

  // ---- the loop ----------------------------------------------------------

  /** One ticker fire: run every tick the clock owes (capped; the surplus is reported, never silent). */
  private onTickerFire(): void {
    if (this.isLoopPaused) return;
    const dueTicks = this.accumulator.dueTicks();
    const droppedTicks = this.accumulator.takeDroppedTicks();
    if (droppedTicks > 0) this.performanceTracker.recordDroppedTicks(droppedTicks);
    for (let count = 0; count < dueTicks; count += 1) this.runTick();
  }

  private runTick(): void {
    const tickStartMs = this.timing.clock.nowMilliseconds();
    this.game.reduceGameState();
    const snapshot = this.game.serializeRoomState();
    const bytes = broadcastMessage(this.playerConnections.values(), {
      type: SERVER_MESSAGE_TYPE.gameSnapshot,
      snapshot,
    });
    this.tickCount += 1;
    this.performanceTracker.recordTick({
      tickMs: this.timing.clock.nowMilliseconds() - tickStartMs,
      snapshotBytes: bytes,
      broadcastClients: this.playerConnections.size,
    });
  }
}
