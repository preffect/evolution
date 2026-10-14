// Snapshot dispatch (docs/architecture/wire-contract.md §4 and §4.1): what one room sends each connection when it
// broadcasts, and the `game_state` that rebuilds a client's whole view. `GameRoom` decides when a broadcast happens
// (its loop, a debug step, a republish, an ack while paused); this decides who is sent the delta, who a `game_state`
// instead and who nothing (`SnapshotBacklog`), sends them, and reports every byte to the `PerformanceTracker` — the
// loop's own broadcast through the tick record it returns, everything else as it is sent (#276, #714).

import {
  SERVER_MESSAGE_TYPE,
  type GameId,
  type GameSessionConfig,
  type PlayerId,
  type ServerMessage,
} from '@evolution/shared';
import type { FullGameState, RoomBroadcastSnapshot, RoomGameModule } from '../game/game-module.js';
import type { Connection } from '../ws/connection.js';
import { sendMessage } from '../ws/connection.js';
import { NOTHING_BROADCAST, type PerformanceTracker, type SnapshotBroadcast } from './performance-tracker.js';
import { SNAPSHOT_DELIVERY, type SnapshotBacklog } from './snapshot-backlog.js';
import { broadcastForViewer, sendSnapshotToViewers, snapshotForViewer } from './viewer-snapshots.js';

/** The part of a room the dispatch reads: its roster, its connections, its flow control and telemetry. */
export interface SnapshotDispatchRoom {
  readonly gameId: GameId;
  readonly sessionConfig: GameSessionConfig;
  readonly allPlayerIds: readonly string[];
  readonly avatarAssignments: Record<string, number>;
  readonly playerConnections: ReadonlyMap<string, Connection>;
  readonly snapshotBacklog: SnapshotBacklog;
  readonly performanceTracker: PerformanceTracker;
  isPaused(): boolean;
}

/** One room's snapshot sending: every message that carries the world to a client goes out through here, counted. */
export class SnapshotDispatch {
  constructor(
    private readonly game: RoomGameModule,
    private readonly room: SnapshotDispatchRoom,
  ) {}

  /** The loop's broadcast: its `game_snapshot` goes on the tick record the room is measuring. */
  broadcastOnTick(): SnapshotBroadcast {
    return this.broadcast();
  }

  /**
   * A broadcast outside the loop's cadence: a debug step's closing frame or a republish after a debug mutation
   * (docs/architecture/debug-mcp.md §8). No tick record is being measured, so its bytes land on the next one (#714).
   */
  broadcastOffTick(): void {
    const { snapshotBytes, broadcastClients } = this.broadcast();
    this.room.performanceTracker.recordOffTickBytes(snapshotBytes * broadcastClients);
  }

  /**
   * The `game_state` a start, late join or reconnect sends (docs/architecture/wire-contract.md §4). Not a resync: the
   * backlog is the caller's to settle. Counted off the tick record, since no tick record is being measured (#714).
   */
  sendGameState(connection: Connection): void {
    const message = this.gameStateMessageFor(connection.playerId as PlayerId);
    this.room.performanceTracker.recordOffTickBytes(sendMessage(connection, message));
  }

  /**
   * The newest snapshot tick a client has applied (#266). A running room settles a resync this makes due on its next
   * broadcast; a paused one makes none, so it is sent now (#300: a step deeper than the backlog limit otherwise left
   * the client frozen until a resume).
   */
  acknowledge(playerId: string, tick: number): void {
    const { snapshotBacklog } = this.room;
    snapshotBacklog.recordAcknowledgedTick(playerId, tick);
    const connection = this.room.playerConnections.get(playerId);
    if (!this.room.isPaused() || connection === undefined || !snapshotBacklog.isResyncDue(connection)) return;
    const state = this.game.serializeFullState();
    snapshotBacklog.recordResyncSent(playerId, state.snapshot.tick);
    this.sendResync(connection, state);
  }

  /**
   * The `game_state` a player receives on start, late join, reconnect and resync
   * (docs/architecture/wire-contract.md §4): the module's full snapshot as that player sees it, and the live balance.
   */
  gameStateMessageFor(playerId: PlayerId, state: FullGameState = this.game.serializeFullState()): ServerMessage {
    const { snapshot, balance } = state;
    return this.gameStateMessage(playerId, { snapshot: snapshotForViewer(this.game, snapshot, playerId), balance });
  }

  /** A `game_state` around a snapshot already as `playerId` sees it. */
  private gameStateMessage(playerId: PlayerId, { snapshot, balance }: FullGameState): ServerMessage {
    return {
      type: SERVER_MESSAGE_TYPE.gameState,
      gameId: this.room.gameId,
      playerId,
      snapshot,
      balance,
      config: this.room.sessionConfig,
      playerIds: this.room.allPlayerIds as PlayerId[],
      avatarAssignments: this.room.avatarAssignments,
    };
  }

  /**
   * The delta since the previous broadcast (docs/architecture/entity-model.md §1). `serializeRoomState` runs on every
   * broadcast whatever the connections are doing: it is the one drain of the effects. What each connection's members
   * advance from it is the module's (a viewer skipped here has its per-viewer food delta left where it was). Who
   * receives it is then per connection (#266) — a client that has not caught up with what it was already sent is
   * skipped rather than queued deeper, and is sent one `game_state` in place of the next delta once it has.
   */
  private broadcast(): SnapshotBroadcast {
    const snapshot = this.game.serializeRoomState();
    if (this.game.isViewRestartBroadcast?.() === true) return this.broadcastViewRestart(snapshot);
    const isRoomPaused = this.room.isPaused();
    const deltaTargets: Connection[] = [];
    for (const connection of this.room.playerConnections.values()) {
      const delivery = this.room.snapshotBacklog.nextFor(connection, snapshot.tick, isRoomPaused);
      if (delivery === SNAPSHOT_DELIVERY.delta) deltaTargets.push(connection);
      else if (delivery === SNAPSHOT_DELIVERY.resync) this.sendResync(connection);
    }
    const snapshotBytes = sendSnapshotToViewers(this.game, deltaTargets, snapshot);
    return { snapshotBytes, broadcastClients: deltaTargets.length };
  }

  /**
   * The broadcast that holds a change no delta carries (the Evolution pool's move, docs/architecture/wire-contract.md §4
   * "The move"): every connection the flow control would send anything is sent it as a `game_state`, its window's
   * effects included, and counted as a resync, so the one-resync-in-flight hold covers it. A connection it holds is
   * sent nothing and owed a resync, which reaches it with the changed world once it catches up.
   */
  private broadcastViewRestart(snapshot: RoomBroadcastSnapshot): SnapshotBroadcast {
    const { snapshotBacklog, performanceTracker } = this.room;
    const { balance } = this.game.serializeFullState();
    for (const connection of this.room.playerConnections.values()) {
      const playerId = connection.playerId as PlayerId;
      const delivery = snapshotBacklog.nextFor(connection, snapshot.tick, this.room.isPaused());
      if (delivery === SNAPSHOT_DELIVERY.skipped) {
        snapshotBacklog.oweResync(playerId);
        continue;
      }
      // A delivery the backlog decided was a resync is already counted as one.
      if (delivery === SNAPSHOT_DELIVERY.delta) snapshotBacklog.recordResyncSent(playerId, snapshot.tick);
      const state = { snapshot: broadcastForViewer(this.game, snapshot, playerId), balance };
      performanceTracker.recordResyncBytes(sendMessage(connection, this.gameStateMessage(playerId, state)));
    }
    return NOTHING_BROADCAST;
  }

  /** Every resync is counted as it is sent, in the bandwidth of the tick it was sent on or the next (#276). */
  private sendResync(connection: Connection, state?: FullGameState): void {
    const resync = this.gameStateMessageFor(connection.playerId as PlayerId, state);
    this.room.performanceTracker.recordResyncBytes(sendMessage(connection, resync));
  }
}
