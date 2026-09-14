import type { PlayerId } from '@evolution/shared';
import { DISCONNECT_GRACE_MS, SERVER_MESSAGE_TYPE } from '@evolution/shared';
import { broadcastMessage } from '../ws/connection.js';
import type { GameRoom } from './game-room.js';
import type { PendingGame } from './pending-game.js';

/** The lobby state a seat lives in: pending games, active rooms and the player -> game index. */
export interface LobbyRegistry {
  readonly pendingGames: Map<string, PendingGame>;
  readonly activeRooms: Map<string, GameRoom>;
  readonly playerToGame: Map<string, string>;
}

/**
 * How a player's seat is freed (docs/architecture/wire-contract.md §4, docs/game-design/session.md §5.2): a
 * disconnect and its grace window, `leave_game`, taking a seat in another room (#334), and the teardown of a room
 * its last player leaves. The `LobbyManager` owns the registry and hands every lobby change back to
 * `broadcastLobbyUpdate`.
 */
export class SeatLifecycle {
  /** playerId -> timer that will finalize their removal after the grace period. */
  private readonly pendingRemovals = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly registry: LobbyRegistry,
    private readonly broadcastLobbyUpdate: () => void,
  ) {}

  /** The player's socket closed: a pending game frees the seat at once, an active room holds it for the grace. */
  dropConnection(playerId: string): void {
    const gameId = this.registry.playerToGame.get(playerId);
    if (!gameId) return;

    const pending = this.registry.pendingGames.get(gameId);
    if (pending) {
      this.leavePendingGame(pending, playerId);
      return;
    }

    // Active room: keep a grace window for reconnect.
    const room = this.registry.activeRooms.get(gameId);
    if (!room) return;
    room.disconnectedPlayers.add(playerId);
    this.announcePlayerGone(room, playerId);

    const timer = setTimeout(() => this.finalizeRemoval(gameId, playerId), DISCONNECT_GRACE_MS);
    this.pendingRemovals.set(playerId, timer);
  }

  /**
   * `leave_game` (#319, docs/architecture/wire-contract.md §4): off the room at once, with no grace. A pending game
   * frees the seat at once, as a disconnect from it does; an active room removes the player the way the end of the
   * grace does and tells the players left behind. A room the player is not seated in (the lobby, an unknown or
   * another room) is a no-op.
   */
  leave(playerId: string, gameId: string): void {
    if (this.registry.playerToGame.get(playerId) !== gameId) return;
    const pending = this.registry.pendingGames.get(gameId);
    if (pending) {
      this.leavePendingGame(pending, playerId);
      return;
    }
    // Defensive: `handleConnect` already cancels a drop's timer before any frame arrives.
    this.cancelPendingRemoval(playerId);
    const room = this.registry.activeRooms.get(gameId);
    if (!room) return;
    this.removeFromActiveRoom(gameId, playerId);
    this.announcePlayerGone(room, playerId);
  }

  /**
   * Before `join_game` or `create_game` seats the player in `gameId` (#334): a seat still held in any other room is
   * left the way `leave_game` leaves it, so no ghost seat stays behind. The seat in `gameId` itself is kept.
   */
  leaveOtherSeat(playerId: string, gameId: string): void {
    const seatedGameId = this.registry.playerToGame.get(playerId);
    if (seatedGameId === undefined || seatedGameId === gameId) return;
    this.leave(playerId, seatedGameId);
  }

  cancelPendingRemoval(playerId: string): void {
    const timer = this.pendingRemovals.get(playerId);
    if (!timer) return;
    clearTimeout(timer);
    this.pendingRemovals.delete(playerId);
  }

  teardownRoom(gameId: string): void {
    const room = this.registry.activeRooms.get(gameId);
    if (!room) return;
    room.stop();
    for (const playerId of room.allPlayerIds) this.registry.playerToGame.delete(playerId);
    this.registry.activeRooms.delete(gameId);
    this.broadcastLobbyUpdate();
  }

  /** `delete_game` on a pending game (the verb checks the creator): every seat in it is freed at once. */
  deletePendingGame(gameId: string): void {
    const pending = this.registry.pendingGames.get(gameId);
    if (!pending) return;
    for (const playerId of pending.players.keys()) this.registry.playerToGame.delete(playerId);
    this.registry.pendingGames.delete(gameId);
    this.broadcastLobbyUpdate();
  }

  /** Pending game: remove immediately (no in-progress state to preserve). */
  private leavePendingGame(pending: PendingGame, playerId: string): void {
    pending.players.delete(playerId);
    this.registry.playerToGame.delete(playerId);
    if (pending.players.size === 0) {
      this.registry.pendingGames.delete(pending.gameId);
    } else if (pending.creatorId === playerId) {
      // Hand creator role to the next remaining player.
      const next = pending.players.keys().next().value;
      if (next) pending.creatorId = next;
    }
    this.broadcastLobbyUpdate();
  }

  /** What the players still in the room hear when one drops or leaves. */
  private announcePlayerGone(room: GameRoom, playerId: string): void {
    broadcastMessage(room.playerConnections.values(), {
      type: SERVER_MESSAGE_TYPE.playerDisconnected,
      playerId: playerId as PlayerId,
    });
  }

  /** The grace window elapsed without a reconnect. */
  private finalizeRemoval(gameId: string, playerId: string): void {
    this.pendingRemovals.delete(playerId);
    this.removeFromActiveRoom(gameId, playerId);
  }

  /** Off the room for good (the module dissolves the cell into detritus); an empty room is torn down. */
  private removeFromActiveRoom(gameId: string, playerId: string): void {
    const room = this.registry.activeRooms.get(gameId);
    if (!room) return;
    room.removePlayer(playerId);
    this.registry.playerToGame.delete(playerId);
    if (room.playerConnections.size === 0) this.teardownRoom(gameId);
    else this.broadcastLobbyUpdate();
  }
}
