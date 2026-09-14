// What one connection is sent of the room's snapshot (docs/architecture/wire-contract.md §4.1). The module
// serialises once per broadcast — the one drain of the effects and the food delta — and, when it has a
// `serializeOwnProgress`, every connection is sent that snapshot with its own progress, which no other client is
// sent. The shared message is stringified once and each viewer's progress is spliced in at its end: a whole
// stringify per viewer grew with the clients (#331's review: 1.8 ms at 8, 14.6 ms at 64). A module without one
// sends every connection the same snapshot, serialised once.

import { SERVER_MESSAGE_TYPE, type GameSnapshot, type PlayerId, type PlayerProgressView } from '@evolution/shared';
import type { GameModule } from '../game/game-module.js';
import type { Connection } from '../ws/connection.js';
import { broadcastMessage, sendRaw } from '../ws/connection.js';

/** The member the splice writes last, typed as the snapshot's own field name. */
const OWN_PROGRESS_KEY = 'ownProgress' satisfies keyof GameSnapshot;
const EMPTY_OBJECT_JSON = '{}';
const CLOSING_BRACE = '}';
const MEMBER_SEPARATOR = ',';
/** `{"type":"game_snapshot","snapshot":` — the message members before the snapshot object. */
const MESSAGE_HEAD = `{"type":${JSON.stringify(SERVER_MESSAGE_TYPE.gameSnapshot)},"snapshot":`;
/** Closes the snapshot object, then the message object. */
const SNAPSHOT_AND_MESSAGE_CLOSE = `${CLOSING_BRACE}${CLOSING_BRACE}`;

/** `snapshot` as `viewerPlayerId` receives it: carrying the module's own progress for that viewer, or as is. */
export function snapshotForViewer(game: GameModule, snapshot: GameSnapshot, viewerPlayerId: PlayerId): GameSnapshot {
  if (game.serializeOwnProgress === undefined) return snapshot;
  return { ...snapshot, ownProgress: game.serializeOwnProgress(viewerPlayerId) };
}

/**
 * The `game_snapshot` message for `snapshot` as JSON text left open at its end: every snapshot member but
 * `ownProgress`, then `"ownProgress":`. Built from structural pieces only — the stringified snapshot without that
 * member, less its closing brace — so no player data (a name with quotes or backslashes) is searched or replaced.
 */
export function openSnapshotFrame(snapshot: GameSnapshot): string {
  const sharedJson = JSON.stringify({ ...snapshot, [OWN_PROGRESS_KEY]: undefined });
  const openObject = sharedJson.slice(0, sharedJson.length - CLOSING_BRACE.length);
  const separator = sharedJson === EMPTY_OBJECT_JSON ? '' : MEMBER_SEPARATOR;
  return `${MESSAGE_HEAD}${openObject}${separator}${JSON.stringify(OWN_PROGRESS_KEY)}:`;
}

/** One viewer's whole `game_snapshot` message: `openFrame` closed with that viewer's own progress. */
export function closeSnapshotFrame(openFrame: string, ownProgress: PlayerProgressView | null): string {
  return `${openFrame}${JSON.stringify(ownProgress)}${SNAPSHOT_AND_MESSAGE_CLOSE}`;
}

/**
 * Sends `snapshot` as a `game_snapshot` to every target, each with its own progress. Answers the bytes one
 * client was sent — the mean over the targets, a closed socket counting none — which is what
 * `PerformanceTracker` multiplies by the clients.
 */
export function sendSnapshotToViewers(
  game: GameModule,
  targets: readonly Connection[],
  snapshot: GameSnapshot,
): number {
  if (targets.length === 0) return 0;
  if (game.serializeOwnProgress === undefined) {
    return broadcastMessage(targets, { type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot });
  }
  const openFrame = openSnapshotFrame(snapshot);
  let totalBytes = 0;
  for (const connection of targets) {
    const frame = closeSnapshotFrame(openFrame, game.serializeOwnProgress(connection.playerId as PlayerId));
    if (sendRaw(connection, frame)) totalBytes += frame.length;
  }
  return Math.round(totalBytes / targets.length);
}
