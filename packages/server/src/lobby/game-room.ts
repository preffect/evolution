import type {
  PlayerId,
  GameId,
  GameSnapshot,
  GameInput,
  GameSessionConfig,
  LobbyPlayerInfo,
  ServerMessage,
} from '@evolution/shared';
import type { ClientPerformanceReport } from '@evolution/shared';
import {
  SERVER_MESSAGE_TYPE,
  SNAPSHOT_EVERY_TICKS,
  createSimulationStepAccumulator,
  type FixedStepAccumulator,
} from '@evolution/shared';
import type { Connection } from '../ws/connection.js';
import { broadcastMessage, sendMessage } from '../ws/connection.js';
import { PerformanceTracker } from './performance-tracker.js';
import { SNAPSHOT_DELIVERY, SnapshotBacklog } from './snapshot-backlog.js';
import type { RoomTiming } from './room-timing.js';
import type { FullGameState, GameModule, RoomInitOptions } from '../game/game-module.js';
import type { SimulationDebugHandle } from '../game/debug/simulation-debug-handle.js';
import { DebugRequestError } from '../game/debug/debug-request-error.js';

/**
 * A running game session. Owns the connections, the late-join/disconnect
 * bookkeeping, the fixed-tick loop and perf telemetry. All game-specific guts
 * live behind the injected `GameModule` (the 3 tick hooks + add/removePlayer).
 *
 * Time flows in through `RoomTiming` only (docs/determinism/contract-and-clock.md §2): the ticker wakes the loop,
 * the accumulator turns the clock into whole ticks, and the debug tools can pause the loop and
 * step it by hand for deterministic screenshots (docs/architecture/debug-mcp.md §8).
 */
export class GameRoom {
  readonly gameId: GameId;
  readonly playerConnections = new Map<string, Connection>();
  readonly disconnectedPlayers = new Set<string>();
  readonly allPlayerIds: string[];
  readonly creatorId: PlayerId;
  readonly gameName: string;
  readonly sessionConfig: GameSessionConfig;
  readonly avatarAssignments: Record<string, number>;
  readonly playerNames: Record<string, string>;
  readonly performanceTracker = new PerformanceTracker();
  /** Who is behind on the wire and owes a `game_state` (#266, docs/architecture/wire-contract.md §4). */
  readonly snapshotBacklog = new SnapshotBacklog();

  private readonly game: GameModule;
  private readonly timing: RoomTiming;
  private readonly accumulator: FixedStepAccumulator;
  private isLoopPaused = false;
  private isLoopStarted = false;
  private tickCount = 0;

  constructor(game: GameModule, options: RoomInitOptions, timing: RoomTiming) {
    this.game = game;
    this.timing = timing;
    this.accumulator = createSimulationStepAccumulator(timing.clock);
    this.gameId = options.gameId;
    this.creatorId = options.creatorId;
    this.allPlayerIds = [...options.playerIds];
    this.gameName = options.gameName;
    this.sessionConfig = options.config;
    this.avatarAssignments = { ...options.avatarAssignments };
    this.playerNames = { ...options.playerNames };
  }

  /** Starts the loop. Time that passed since construction is discarded, so the first fire never bursts. */
  start(): void {
    if (this.isLoopStarted) return;
    this.isLoopStarted = true;
    this.accumulator.discardElapsed();
    this.timing.ticker.start(() => this.onTickerFire());
  }

  stop(): void {
    if (this.isLoopStarted) {
      this.timing.ticker.stop();
      this.isLoopStarted = false;
    }
    this.game.free?.();
  }

  // ---- debug loop control (docs/architecture/debug-mcp.md §8) ----------------------

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
    // A stepped room always ends on a fresh frame, whatever the cadence (docs/architecture/debug-mcp.md §8).
    if (this.tickCount % SNAPSHOT_EVERY_TICKS !== 0) this.broadcastSnapshot();
  }

  /**
   * Sends everyone the frame at the current tick without stepping: a debug mutation calls it so a
   * paused room shows the patched world instead of the frame from before it (docs/architecture/debug-mcp.md §8).
   */
  republishSnapshot(): void {
    this.broadcastSnapshot();
  }

  /** Unfreezes the loop. The wall time that passed while paused is discarded, never caught up. */
  resume(): void {
    this.isLoopPaused = false;
    this.accumulator.discardElapsed();
  }

  getDebugHandle(): SimulationDebugHandle | undefined {
    return this.game.getDebugHandle?.();
  }

  /** After `debug_set_balance` (docs/architecture/wire-contract.md §4): every client predicts with the balance the module now simulates. */
  broadcastBalanceUpdated(): void {
    broadcastMessage(this.playerConnections.values(), {
      type: SERVER_MESSAGE_TYPE.balanceUpdated,
      balance: this.getFullState().balance,
    });
  }

  // ---- membership --------------------------------------------------------

  addPlayer(connection: Connection): void {
    this.playerConnections.set(connection.playerId, connection);
  }

  /** A reconnect is a new `game_state` (docs/architecture/wire-contract.md §4), so it settles any resync owed. */
  reattachPlayer(connection: Connection): void {
    this.playerConnections.set(connection.playerId, connection);
    this.disconnectedPlayers.delete(connection.playerId);
    this.snapshotBacklog.forget(connection.playerId);
  }

  submitInput(playerId: string, payload: GameInput): void {
    this.game.submitInput(playerId as PlayerId, payload);
  }

  recordClientPerformance(playerId: string, report: ClientPerformanceReport): void {
    this.performanceTracker.recordClientReport(playerId as PlayerId, report);
  }

  /** The newest snapshot tick a client has applied (#266, docs/architecture/wire-contract.md §4): its flow control. */
  recordSnapshotAck(playerId: string, tick: number): void {
    this.snapshotBacklog.recordAcknowledgedTick(playerId, tick);
  }

  getSnapshot(): GameSnapshot {
    return this.game.serializeRoomState();
  }

  /** The `game_state` payload (docs/architecture/wire-contract.md §4): the module's full snapshot and live balance. */
  getFullState(): FullGameState {
    return this.game.serializeFullState();
  }

  /** Player who was never part of the session joins an in-progress game. */
  addLatePlayer(connection: Connection): void {
    const playerId = connection.playerId as PlayerId;
    this.playerConnections.set(playerId, connection);
    this.game.addPlayer(playerId, connection.avatarIndex, connection.playerName);
    this.enrol({ playerId, playerName: connection.playerName, avatarIndex: connection.avatarIndex });
    sendMessage(connection, this.gameStateMessageFor(playerId));
  }

  /**
   * The `game_state` a player receives on start, late join, reconnect and resync
   * (docs/architecture/wire-contract.md §4): the one message that rebuilds a client's whole view.
   */
  gameStateMessageFor(playerId: PlayerId): ServerMessage {
    return {
      type: SERVER_MESSAGE_TYPE.gameState,
      gameId: this.gameId,
      playerId,
      ...this.getFullState(),
      config: this.sessionConfig,
      playerIds: this.allPlayerIds as PlayerId[],
      avatarAssignments: this.avatarAssignments,
    };
  }

  removePlayer(playerId: string): void {
    this.playerConnections.delete(playerId);
    this.snapshotBacklog.forget(playerId);
    this.disconnectedPlayers.add(playerId);
    this.performanceTracker.removeClient(playerId as PlayerId);
    this.game.removePlayer(playerId as PlayerId);
    this.dropFromRoster(playerId);
  }

  /**
   * A synthetic player the game module drives itself (`debug_spawn_bot`, docs/architecture/debug-mcp.md §8):
   * in the roster and announced like a late joiner, with no connection. The module already holds
   * the player; this only makes it visible to the lobby and the other clients. An id that is
   * already in the roster or on a socket is refused with `DebugRequestError`, so a bot can never
   * shadow a human. `config.maxPlayers` is deliberately not applied: it is the lobby's seat cap
   * for humans, and a debug spawn is the operator filling the dish past it on purpose.
   */
  addSyntheticPlayer(player: LobbyPlayerInfo): void {
    if (this.allPlayerIds.includes(player.playerId) || this.playerConnections.has(player.playerId)) {
      throw new DebugRequestError(`"${player.playerId}" is already a player in this game`);
    }
    this.enrol(player);
  }

  /**
   * Drops a synthetic player from the roster and announces it the way a disconnect is announced.
   * A player with a live socket is refused: it is a human, and `removePlayer` is the way out for
   * those. This is the second home of `player_disconnected` (the first is `LobbyManager`, for a
   * human with the reconnect grace window); they stay apart because a bot gets no grace.
   */
  removeSyntheticPlayer(playerId: PlayerId): void {
    if (this.playerConnections.has(playerId)) {
      throw new DebugRequestError(`"${playerId}" is a connected player, not a synthetic one`);
    }
    this.dropFromRoster(playerId);
    broadcastMessage(this.playerConnections.values(), { type: SERVER_MESSAGE_TYPE.playerDisconnected, playerId });
  }

  /** Records a newcomer in the roster and tells everyone else. */
  private enrol({ playerId, playerName, avatarIndex }: LobbyPlayerInfo): void {
    this.allPlayerIds.push(playerId);
    this.avatarAssignments[playerId] = avatarIndex;
    this.playerNames[playerId] = playerName;
    broadcastMessage(
      Array.from(this.playerConnections.values()).filter((other) => other.playerId !== playerId),
      { type: SERVER_MESSAGE_TYPE.playerJoined, playerId, avatarIndex },
    );
  }

  private dropFromRoster(playerId: string): void {
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
    this.tickCount += 1;
    const isBroadcastTick = this.tickCount % SNAPSHOT_EVERY_TICKS === 0;
    this.performanceTracker.recordTick({
      tickMs: this.timing.clock.nowMilliseconds() - tickStartMs,
      snapshotBytes: isBroadcastTick ? this.broadcastSnapshot() : 0,
      broadcastClients: this.playerConnections.size,
    });
  }

  /**
   * The delta since the previous broadcast, every `SNAPSHOT_EVERY_TICKS` ticks
   * (docs/architecture/entity-model.md §1). `serializeRoomState` runs on every broadcast tick whatever the
   * connections are doing: it is the one drain of the effects and the one step of the food delta
   * tracker. Who receives it is then per connection (#266, docs/architecture/wire-contract.md §4) — a client
   * that has not caught up with what it was already sent is skipped rather than queued deeper, and
   * is sent one `game_state` in place of the next delta once it has.
   */
  private broadcastSnapshot(): number {
    const snapshot = this.game.serializeRoomState();
    const deltaTargets: Connection[] = [];
    for (const connection of this.playerConnections.values()) {
      const delivery = this.snapshotBacklog.nextFor(connection, snapshot.tick);
      if (delivery === SNAPSHOT_DELIVERY.delta) {
        deltaTargets.push(connection);
      } else if (delivery === SNAPSHOT_DELIVERY.resync) {
        sendMessage(connection, this.gameStateMessageFor(connection.playerId as PlayerId));
      }
    }
    if (deltaTargets.length === 0) return 0;
    return broadcastMessage(deltaTargets, { type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot });
  }
}
