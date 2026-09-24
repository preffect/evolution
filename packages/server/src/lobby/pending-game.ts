import type { GameId, GameSessionConfig, LobbyPlayerInfo, PlayerId } from '@evolution/shared';
import type { RoomInitOptions } from '../game/game-module.js';
import type { Connection } from '../ws/connection.js';
import { assignSeatColours } from './seat-colours.js';

/** A game that has been created but not yet started — players gather here. */
export interface PendingGame {
  gameId: string;
  gameName: string;
  creatorId: string;
  config: GameSessionConfig;
  /** playerId -> presence. */
  players: Map<string, LobbyPlayerInfo>;
}

/** How a connection is listed in a pending game's roster. */
export function lobbyPresenceOf(connection: Connection): LobbyPlayerInfo {
  return {
    playerId: connection.playerId as PlayerId,
    playerName: connection.playerName,
    avatarIndex: connection.avatarIndex,
  };
}

/** The roster a pending game hands to its room and game module when it starts. */
export function roomInitOptionsOf(pending: PendingGame): RoomInitOptions {
  const playerNames: Record<string, string> = {};
  for (const [playerId, info] of pending.players) playerNames[playerId] = info.playerName;
  const seats = Array.from(pending.players, ([playerId, info]) => [playerId, info.avatarIndex] as const);
  return {
    gameId: pending.gameId as GameId,
    creatorId: pending.creatorId as PlayerId,
    playerIds: Array.from(pending.players.keys()) as PlayerId[],
    gameName: pending.gameName,
    config: pending.config,
    avatarAssignments: assignSeatColours(seats),
    playerNames,
  };
}
