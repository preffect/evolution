// What one connection is sent of the room's snapshot (docs/architecture/wire-contract.md §4.1). The module
// serialises once per broadcast — the one drain of the effects and the food delta — and then, when it has a
// `snapshotForViewer`, projects that snapshot for each connection: the Evolution module adds the viewer's own
// progress, which no other client is sent. A module without one sends every connection the same snapshot,
// serialised once.

import { SERVER_MESSAGE_TYPE, type GameSnapshot, type PlayerId } from '@evolution/shared';
import type { GameModule } from '../game/game-module.js';
import type { Connection } from '../ws/connection.js';
import { broadcastMessage, sendMessage } from '../ws/connection.js';

/** `snapshot` as `viewerPlayerId` receives it: the module's projection, or the snapshot itself. */
export function snapshotForViewer(game: GameModule, snapshot: GameSnapshot, viewerPlayerId: PlayerId): GameSnapshot {
  return game.snapshotForViewer?.(snapshot, viewerPlayerId) ?? snapshot;
}

/**
 * Sends `snapshot` as a `game_snapshot` to every target, each as its viewer receives it. Answers the bytes
 * one client was sent — the mean over the targets when each is sent its own — which is what
 * `PerformanceTracker` multiplies by the clients.
 */
export function sendSnapshotToViewers(
  game: GameModule,
  targets: readonly Connection[],
  snapshot: GameSnapshot,
): number {
  if (targets.length === 0) return 0;
  if (game.snapshotForViewer === undefined) {
    return broadcastMessage(targets, { type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot });
  }
  let totalBytes = 0;
  for (const connection of targets) {
    const viewed = snapshotForViewer(game, snapshot, connection.playerId as PlayerId);
    totalBytes += sendMessage(connection, { type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot: viewed });
  }
  return Math.round(totalBytes / targets.length);
}
