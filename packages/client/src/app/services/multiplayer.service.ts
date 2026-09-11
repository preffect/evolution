import { Injectable, computed, inject, signal } from '@angular/core';
import { concat, defer, of, type Observable } from 'rxjs';
import type {
  GameId,
  GameInput,
  GameSessionConfig,
  GameSnapshot,
  LobbyGameInfo,
  PlayerId,
  ServerMessage,
} from '@evolution/shared';
import { CLIENT_MESSAGE_TYPE, SERVER_MESSAGE_TYPE } from '@evolution/shared';
import { WebSocketService } from './websocket.service';

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
 *   2. `snapshot` signal + `latestSnapshot()` — inbound: the opaque
 *      `GameSnapshot` your renderer consumes. See `game/game-setup.ts`.
 */
export type Phase = 'lobby' | 'in-game';

@Injectable({ providedIn: 'root' })
export class MultiplayerService {
  private readonly transport = inject(WebSocketService);
  /** The newest `game_state`, replayed to a composition root that subscribes after it arrived. */
  private latestGameStateMessage: ServerMessage | null = null;

  // ===== Connection =====
  /** Live WebSocket connection flag (mirrors the transport). */
  readonly connected = this.transport.connected;

  // ===== Lobby / room state (generic) =====
  readonly phase = signal<Phase>('lobby');
  readonly games = signal<LobbyGameInfo[]>([]);
  readonly playerId = signal<PlayerId | null>(null);
  readonly gameId = signal<GameId | null>(null);
  readonly playerIds = signal<PlayerId[]>([]);
  readonly isHost = signal(false);
  readonly avatarAssignments = signal<Record<string, number>>({});
  readonly sessionConfig = signal<GameSessionConfig | null>(null);
  readonly lastError = signal<string | null>(null);

  /**
   * Most recent opaque game snapshot received from the server. The template's
   * default "echo" GameModule fills this in; a real game replaces the
   * `GameSnapshot` type and renders it. TODO(game): consume in your renderer.
   */
  readonly snapshot = signal<GameSnapshot | null>(null);

  readonly inGame = computed(() => this.phase() === 'in-game');

  constructor() {
    this.transport.messages$.subscribe((message) => this.handle(message));
  }

  // ===== Lifecycle =====
  connect(): void {
    this.transport.connect();
  }

  disconnect(): void {
    this.transport.disconnect();
  }

  // ===== Lobby actions (generic verbs) =====
  joinLobby(playerName: string, avatarIndex = 0): void {
    this.transport.send({ type: CLIENT_MESSAGE_TYPE.joinLobby, playerName, avatarIndex });
  }

  updatePlayerInfo(playerName: string, avatarIndex: number): void {
    this.transport.send({ type: CLIENT_MESSAGE_TYPE.updatePlayerInfo, playerName, avatarIndex });
  }

  createGame(gameName: string, config: GameSessionConfig): void {
    // TODO(game): extend `config` with game-specific session fields before send.
    this.transport.send({ type: CLIENT_MESSAGE_TYPE.createGame, gameName, config });
  }

  joinGame(id: string): void {
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

  /** The raw freshest snapshot message, for the render loop that owns interpolation. */
  drainLatestSnapshotMessage(): ServerMessage | null {
    return this.transport.drainLatestSnapshot();
  }

  /** Drain the freshest un-rendered snapshot frame (call once per render frame). */
  latestSnapshot(): GameSnapshot | null {
    const message = this.transport.drainLatestSnapshot();
    if (message && message.type === SERVER_MESSAGE_TYPE.gameSnapshot) {
      this.snapshot.set(message.snapshot);
      return message.snapshot;
    }
    return null;
  }

  // ===== Inbound message handling =====
  private handle(message: ServerMessage): void {
    switch (message.type) {
      case SERVER_MESSAGE_TYPE.lobbyUpdate:
        this.games.set(message.games);
        break;

      case SERVER_MESSAGE_TYPE.gameStarted:
        this.playerId.set(message.playerId);
        this.gameId.set(message.gameId);
        this.playerIds.set(message.playerIds);
        this.isHost.set(message.isHost);
        this.sessionConfig.set(message.config);
        this.phase.set('in-game');
        break;

      case SERVER_MESSAGE_TYPE.gameState:
        // Sent on start and to a (re)joining player: full room state to (re)build the view.
        this.latestGameStateMessage = message;
        this.playerId.set(message.playerId);
        this.gameId.set(message.gameId);
        this.playerIds.set(message.playerIds);
        this.sessionConfig.set(message.config);
        this.avatarAssignments.set(message.avatarAssignments);
        this.snapshot.set(message.snapshot);
        this.phase.set('in-game');
        break;

      case SERVER_MESSAGE_TYPE.gameSnapshot:
        // Hot path is normally handled by the coalescing drain in the render
        // loop; this branch covers any snapshot that arrives via messages$.
        this.snapshot.set(message.snapshot);
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
