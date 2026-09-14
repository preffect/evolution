import { Injectable, computed, inject, signal } from '@angular/core';
import { concat, defer, of, type Observable } from 'rxjs';
import type { GameInput, GameSessionConfig, LobbyGameInfo, ServerMessage, ValueOf } from '@evolution/shared';
import { CLIENT_MESSAGE_TYPE, SERVER_MESSAGE_TYPE } from '@evolution/shared';
import { LeftRoomFilter } from './left-room-filter';
import { RoomState } from './room-state';
import { SEAT_RECOVERY_OUTCOME, SeatRecovery } from './seat-recovery';
import { SOCKET_LIFECYCLE, WebSocketService, type SocketLifecycleEvent } from './websocket.service';

/**
 * Generic, GAME-AGNOSTIC multiplayer networking + state service.
 *
 * This is the primary client entry point for multiplayer. It owns the
 * connection lifecycle, drives the lobby -> create/join -> in-game flow, and
 * exposes everything the UI needs as Angular signals. It deliberately knows
 * NOTHING about any specific game's rules, board, or rendering.
 *
 * Game-specific code plugs in at two clearly marked seams:
 *   1. `sendInput(payload)` — outbound: wrap your game's input shape (`GameInput`).
 *   2. `gameMessages$` — inbound: every server message in order, which the render session
 *      applies to its `WorldStore` (`game/game-setup.ts`); the `snapshot` signal mirrors the newest.
 */
export type Phase = 'lobby' | 'in-game';

/** Why the lobby came back on its own (docs/ui/overlays.md §3.6); the lobby screen words it. */
export const LOBBY_NOTICE = {
  /** The socket dropped mid-round and the server no longer held the seat when it reopened. */
  disconnectedFromGame: 'disconnected_from_game',
} as const;

export type LobbyNotice = ValueOf<typeof LOBBY_NOTICE>;

interface LobbyAnnouncement {
  readonly playerName: string;
  readonly avatarIndex: number;
}

@Injectable({ providedIn: 'root' })
export class MultiplayerService {
  private readonly transport = inject(WebSocketService);
  /** The newest `game_state`, replayed to a composition root that subscribes after it arrived. */
  private latestGameStateMessage: ServerMessage | null = null;
  private readonly room = new RoomState();
  private readonly seatRecovery = new SeatRecovery();
  private readonly leftRoom = new LeftRoomFilter();
  /** The newest name and avatar this client announced, re-announced when a dropped socket reopens. */
  private lobbyAnnouncement: LobbyAnnouncement | null = null;

  // ===== Connection =====
  /** Live WebSocket connection flag (mirrors the transport). */
  readonly connected = this.transport.connected;

  // ===== Lobby / room state (generic) =====
  readonly phase = signal<Phase>('lobby');
  readonly games = signal<LobbyGameInfo[]>([]);
  readonly playerId = this.room.playerId;
  readonly gameId = this.room.gameId;
  readonly playerIds = this.room.playerIds;
  readonly isHost = this.room.isHost;
  readonly avatarAssignments = this.room.avatarAssignments;
  readonly sessionConfig = this.room.sessionConfig;
  readonly snapshot = this.room.snapshot;
  readonly balance = this.room.balance;
  readonly lastError = signal<string | null>(null);
  /** Set when the lobby returned without the player asking; cleared by the next room. */
  readonly lobbyNotice = signal<LobbyNotice | null>(null);

  readonly inGame = computed(() => this.phase() === 'in-game');

  constructor() {
    this.transport.messages$.subscribe((message) => this.receive(message));
    this.transport.lifecycle$.subscribe((event) => this.onSocketLifecycle(event));
  }

  // ===== Lifecycle =====
  connect(): void {
    this.transport.connect();
  }

  disconnect(): void {
    this.transport.disconnect();
    this.returnToLobby(null);
  }

  /**
   * Back to the lobby from a room (the menu's and the results screen's `leave()`,
   * docs/ui/components-and-constants.md §7). The wire has no leave verb yet (#319): the server keeps
   * the seat, so that room's frames are dropped until another room starts (`left-room-filter.ts`).
   */
  leave(): void {
    this.leftRoom.left(this.gameId());
    this.returnToLobby(null);
  }

  dismissError(): void {
    this.lastError.set(null);
  }

  // ===== Lobby actions (generic verbs) =====
  joinLobby(playerName: string, avatarIndex = 0): void {
    this.lobbyAnnouncement = { playerName, avatarIndex };
    this.transport.send({ type: CLIENT_MESSAGE_TYPE.joinLobby, playerName, avatarIndex });
  }

  updatePlayerInfo(playerName: string, avatarIndex: number): void {
    this.lobbyAnnouncement = { playerName, avatarIndex };
    this.transport.send({ type: CLIENT_MESSAGE_TYPE.updatePlayerInfo, playerName, avatarIndex });
  }

  createGame(gameName: string, config: GameSessionConfig): void {
    // TODO(game): extend `config` with game-specific session fields before send.
    this.transport.send({ type: CLIENT_MESSAGE_TYPE.createGame, gameName, config });
  }

  joinGame(id: string): void {
    // Asking for a room, even the one just left, is asking for its frames again.
    this.leftRoom.forget();
    this.transport.send({ type: CLIENT_MESSAGE_TYPE.joinGame, gameId: id });
  }

  startGame(id: string): void {
    this.transport.send({ type: CLIENT_MESSAGE_TYPE.startGame, gameId: id });
  }

  deleteGame(id: string): void {
    this.transport.send({ type: CLIENT_MESSAGE_TYPE.deleteGame, gameId: id });
  }

  // ===== Gameplay =====
  /**
   * Send one unit of game input. The payload is the opaque `GameInput` defined
   * by the concrete game. Local-only / client-trusted: the server forwards this
   * to the room's GameModule without semantic validation.
   * TODO(game): call this from your input loop with your typed input shape.
   */
  sendInput(payload: GameInput): void {
    this.transport.send({ type: CLIENT_MESSAGE_TYPE.playerInput, payload });
  }

  /**
   * Tells the server the newest snapshot tick this client has applied (#266,
   * docs/architecture/wire-contract.md §4). Generic flow control, not a game verb: the room reads it to see how
   * far behind its stream this client is, and skips rather than queueing it deeper.
   */
  acknowledgeSnapshot(tick: number): void {
    this.transport.send({ type: CLIENT_MESSAGE_TYPE.snapshotAck, tick });
  }

  /**
   * The message stream the game's composition root (`game/game-setup.ts`) subscribes to: the retained
   * `game_state` first, if one arrived before the game host mounted (the server sends it right after
   * `game_started`, before change detection creates the host), then every live message.
   */
  get gameMessages$(): Observable<ServerMessage> {
    return defer(() => {
      const retained = this.latestGameStateMessage;
      return retained === null ? this.transport.messages$ : concat(of(retained), this.transport.messages$);
    });
  }

  // ===== Connection loss (docs/ui/overlays.md §3.6) =====
  /**
   * A user's close ends the room at once. A dropped socket does not: the round stays on screen
   * under the connection banner while the transport reconnects, and the seat recovery decides from
   * the server's first answer whether the room comes back (`seat-recovery.ts`).
   */
  private onSocketLifecycle(event: SocketLifecycleEvent): void {
    if (event.kind === SOCKET_LIFECYCLE.closed) {
      if (event.isUserInitiated) this.returnToLobby(null);
      else this.seatRecovery.socketDropped(this.inGame());
      return;
    }
    const action = this.seatRecovery.socketReopened(this.lobbyAnnouncement !== null);
    if (action.isSeatLost) this.returnToLobby(LOBBY_NOTICE.disconnectedFromGame);
    // The server answers this to the sender alone, so a frame always follows the reopen.
    if (action.shouldReannounce && this.lobbyAnnouncement !== null) {
      this.transport.send({ type: CLIENT_MESSAGE_TYPE.joinLobby, ...this.lobbyAnnouncement });
    }
  }

  private returnToLobby(notice: LobbyNotice | null): void {
    this.seatRecovery.cancel();
    this.latestGameStateMessage = null;
    this.room.clear();
    this.lobbyNotice.set(notice);
    this.phase.set('lobby');
  }

  // ===== Inbound message handling =====
  private receive(message: ServerMessage): void {
    if (this.seatRecovery.frameReceived(message) === SEAT_RECOVERY_OUTCOME.seatLost) {
      this.returnToLobby(LOBBY_NOTICE.disconnectedFromGame);
    }
    if (this.leftRoom.admits(message)) this.handle(message);
  }

  /** A room message puts this client in play; a notice or an error raised in the lobby belongs to the lobby. */
  private enterRoom(): void {
    this.lobbyNotice.set(null);
    this.lastError.set(null);
    this.phase.set('in-game');
  }

  private handle(message: ServerMessage): void {
    switch (message.type) {
      case SERVER_MESSAGE_TYPE.lobbyUpdate:
        this.games.set(message.games);
        break;

      case SERVER_MESSAGE_TYPE.gameStarted:
        // The room's own game_state follows in the same burst; a previous room's must not be replayed.
        this.latestGameStateMessage = null;
        this.room.applyGameStarted(message);
        this.enterRoom();
        break;

      case SERVER_MESSAGE_TYPE.gameState:
        this.latestGameStateMessage = message;
        this.room.applyGameState(message);
        this.enterRoom();
        break;

      case SERVER_MESSAGE_TYPE.gameSnapshot:
        // The newest snapshot for the lobby UI; the render session applies every one to its store.
        this.snapshot.set(message.snapshot);
        break;

      case SERVER_MESSAGE_TYPE.balanceUpdated:
        // `debug_set_balance`: the HUD must read the same numbers the server now simulates with.
        this.balance.set(message.balance);
        break;

      case SERVER_MESSAGE_TYPE.playerJoined:
        this.playerIds.update((ids) => (ids.includes(message.playerId) ? ids : [...ids, message.playerId]));
        this.avatarAssignments.update((assignments) => ({ ...assignments, [message.playerId]: message.avatarIndex }));
        // TODO(game): react to a player joining mid-game (spawn entity, etc.).
        break;

      case SERVER_MESSAGE_TYPE.playerDisconnected:
        this.playerIds.update((ids) => ids.filter((id) => id !== message.playerId));
        // TODO(game): react to a player leaving (remove entity, pause, etc.).
        break;

      case SERVER_MESSAGE_TYPE.error:
        this.lastError.set(message.message);
        break;

      // TODO(game): handle game-specific server message variants here.
    }
  }
}
