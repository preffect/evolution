// The facts of the room this client is in: who we are in it, who else is, its config, and its newest
// snapshot and balance, each a signal the lobby and the HUD facade read. `MultiplayerService` owns the
// lifecycle around them (phase, reconnects, leaving); this owns only what a room message sets and
// what leaving a room clears (#219).

import { signal } from '@angular/core';
import type {
  BalanceConfig,
  GameId,
  GameSessionConfig,
  GameSnapshot,
  PlayerId,
  SERVER_MESSAGE_TYPE,
  ServerMessage,
} from '@evolution/shared';

type GameStartedMessage = Extract<ServerMessage, { type: typeof SERVER_MESSAGE_TYPE.gameStarted }>;
type GameStateMessage = Extract<ServerMessage, { type: typeof SERVER_MESSAGE_TYPE.gameState }>;

export class RoomState {
  readonly playerId = signal<PlayerId | null>(null);
  readonly gameId = signal<GameId | null>(null);
  readonly playerIds = signal<PlayerId[]>([]);
  readonly isHost = signal(false);
  readonly avatarAssignments = signal<Record<string, number>>({});
  readonly sessionConfig = signal<GameSessionConfig | null>(null);

  /** The newest `game_snapshot`, for the lobby / HUD facade; the renderer reads `WorldStore` instead. */
  readonly snapshot = signal<GameSnapshot | null>(null);

  /**
   * The live balance the server simulates with (`game_state`, then every `balance_updated`), for
   * the HUD facade; the renderer reads the same numbers off its own `WorldStore`.
   */
  readonly balance = signal<BalanceConfig | null>(null);

  /** The room started: who we are and who is in it. Its `game_state` follows in the same burst. */
  applyGameStarted(message: GameStartedMessage): void {
    this.playerId.set(message.playerId);
    this.gameId.set(message.gameId);
    this.playerIds.set(message.playerIds);
    this.isHost.set(message.isHost);
    this.sessionConfig.set(message.config);
  }

  /** Sent on start and to a (re)joining player: full room state to (re)build the view. */
  applyGameState(message: GameStateMessage): void {
    this.playerId.set(message.playerId);
    this.gameId.set(message.gameId);
    this.playerIds.set(message.playerIds);
    this.sessionConfig.set(message.config);
    this.avatarAssignments.set(message.avatarAssignments);
    this.balance.set(message.balance);
    this.snapshot.set(message.snapshot);
  }

  /** Every room fact goes, so the next room starts from nothing a previous one left behind. */
  clear(): void {
    this.playerId.set(null);
    this.gameId.set(null);
    this.playerIds.set([]);
    this.isHost.set(false);
    this.avatarAssignments.set({});
    this.sessionConfig.set(null);
    this.snapshot.set(null);
    this.balance.set(null);
  }
}
