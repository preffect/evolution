// What one connection is sent of the room's snapshot (docs/architecture/wire-contract.md §4.1): the sending policy. The
// module serialises once per broadcast — the one drain of the effects — and may declare `viewerState`: snapshot
// members every connection is sent for itself alone, which the broadcast never builds (#399). The shared message is
// stringified once and each
// viewer's values are appended in the declared order (`ws/snapshot-frame.ts`): a whole stringify per viewer grew with
// the clients (#331's review: 1.8 ms at 8, 14.6 ms at 64). This file names no member; the module declares them. A
// module without `viewerState` sends every connection the same snapshot, serialised once.

import { SERVER_MESSAGE_TYPE, type GameSnapshot, type PlayerId } from '@evolution/shared';
import type { RoomBroadcastSnapshot, RoomGameModule } from '../game/game-module.js';
import type { Connection } from '../ws/connection.js';
import { broadcastMessage, sendRaw } from '../ws/connection.js';
import {
  closeSnapshotFrame,
  openSnapshotFrame,
  requireViewerMember,
  type ViewerMembers,
} from '../ws/snapshot-frame.js';

/** One viewer's values for every declared member, in declared order; a member the module left out throws. */
export function viewerMembersOf(keys: readonly string[], viewerMembers: ViewerMembers): Partial<GameSnapshot> {
  return Object.fromEntries(keys.map((key) => [key, requireViewerMember(viewerMembers, key)])) as Partial<GameSnapshot>;
}

/**
 * The full `snapshot` of a `game_state` as `viewerPlayerId` receives it: carrying that viewer's declared members, or
 * as is. It restarts whatever that viewer's later members are relative to.
 */
export function snapshotForViewer(
  game: RoomGameModule,
  snapshot: GameSnapshot,
  viewerPlayerId: PlayerId,
): GameSnapshot {
  const { viewerState } = game;
  if (viewerState === undefined) return snapshot;
  return { ...snapshot, ...viewerMembersOf(viewerState.keys, viewerState.serializeFull(viewerPlayerId, snapshot)) };
}

/**
 * Sends `snapshot` as a `game_snapshot` to every target, each with its own declared members. Answers the bytes one
 * client was sent — the mean over the targets, a closed socket counting none — which is what `PerformanceTracker`
 * multiplies by the clients.
 */
export function sendSnapshotToViewers(
  game: RoomGameModule,
  targets: readonly Connection[],
  snapshot: RoomBroadcastSnapshot,
): number {
  const { viewerState } = game;
  if (targets.length === 0) return 0;
  if (viewerState === undefined) {
    // A module that declares no viewer member leaves none out: its broadcast is the whole snapshot.
    return broadcastMessage(targets, { type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot: snapshot as GameSnapshot });
  }
  const frame = openSnapshotFrame(snapshot, viewerState.keys);
  const memberJson = viewerState.memberJson?.bind(viewerState);
  let totalBytes = 0;
  for (const connection of targets) {
    const members = viewerState.serialize(connection.playerId as PlayerId, snapshot);
    const message = closeSnapshotFrame(frame, members, memberJson);
    if (sendRaw(connection, message)) totalBytes += message.length;
  }
  return Math.round(totalBytes / targets.length);
}
