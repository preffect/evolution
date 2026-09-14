// What one connection is sent of the room's snapshot (docs/architecture/wire-contract.md §4.1). The module
// serialises once per broadcast — the one drain of the effects and the food delta — and may declare `viewerState`:
// snapshot members every connection is sent for itself alone. The shared message is stringified once without them
// and each viewer's values are appended in the declared order: a whole stringify per viewer grew with the clients
// (#331's review: 1.8 ms at 8, 14.6 ms at 64). This file names no member; the module declares them. A module
// without `viewerState` sends every connection the same snapshot, serialised once.

import { SERVER_MESSAGE_TYPE, type GameSnapshot, type PlayerId } from '@evolution/shared';
import type { GameModule, ViewerStateSerializer } from '../game/game-module.js';
import type { Connection } from '../ws/connection.js';
import { broadcastMessage, sendRaw } from '../ws/connection.js';

const EMPTY_OBJECT_JSON = '{}';
const CLOSING_BRACE = '}';
const MEMBER_SEPARATOR = ',';
const KEY_VALUE_SEPARATOR = ':';
/** `{"type":"game_snapshot","snapshot":` — the message members before the snapshot object. */
const MESSAGE_HEAD = `{"type":${JSON.stringify(SERVER_MESSAGE_TYPE.gameSnapshot)},"snapshot":`;
/** Closes the snapshot object, then the message object. */
const SNAPSHOT_AND_MESSAGE_CLOSE = `${CLOSING_BRACE}${CLOSING_BRACE}`;

/** One viewer's values for the declared members, by member name. */
export type ViewerMembers = Readonly<Partial<Record<string, unknown>>>;

/**
 * The part of every viewer's `game_snapshot` stringified once: the message with the snapshot's viewer members left
 * out and the snapshot object still open. Built from structural pieces only, so no player data (a name with quotes
 * or backslashes) is ever searched or replaced.
 */
export interface OpenSnapshotFrame {
  /** The message up to the snapshot's last shared member. */
  readonly sharedJson: string;
  /** Whether a shared member precedes the viewer members, so a separator goes between them. */
  readonly hasSharedMembers: boolean;
  /** The viewer members each frame is closed with, in order. */
  readonly viewerKeys: readonly string[];
}

/** One viewer's values for every declared member, in declared order; a member the module left out is `null`. */
export function viewerMembersOf(viewerState: ViewerStateSerializer, viewerPlayerId: PlayerId): Partial<GameSnapshot> {
  const values = viewerState.serialize(viewerPlayerId);
  return Object.fromEntries(viewerState.keys.map((key) => [key, values[key] ?? null])) as Partial<GameSnapshot>;
}

/** `snapshot` as `viewerPlayerId` receives it: carrying that viewer's declared members, or as is. */
export function snapshotForViewer(game: GameModule, snapshot: GameSnapshot, viewerPlayerId: PlayerId): GameSnapshot {
  const { viewerState } = game;
  if (viewerState === undefined) return snapshot;
  return { ...snapshot, ...viewerMembersOf(viewerState, viewerPlayerId) };
}

/** Stringifies `snapshot` once without `viewerKeys`: the shared part of every viewer's `game_snapshot`. */
export function openSnapshotFrame(snapshot: GameSnapshot, viewerKeys: readonly string[]): OpenSnapshotFrame {
  const viewerMembersLeftOut = Object.fromEntries(viewerKeys.map((key) => [key, undefined]));
  const snapshotJson = JSON.stringify({ ...snapshot, ...viewerMembersLeftOut });
  return {
    sharedJson: `${MESSAGE_HEAD}${snapshotJson.slice(0, snapshotJson.length - CLOSING_BRACE.length)}`,
    hasSharedMembers: snapshotJson !== EMPTY_OBJECT_JSON,
    viewerKeys,
  };
}

/** One viewer's whole `game_snapshot` message: `frame` closed with that viewer's members, in declared order. */
export function closeSnapshotFrame(frame: OpenSnapshotFrame, viewerMembers: ViewerMembers): string {
  const members = frame.viewerKeys.map(
    (key) => `${JSON.stringify(key)}${KEY_VALUE_SEPARATOR}${JSON.stringify(viewerMembers[key] ?? null)}`,
  );
  const separator = frame.hasSharedMembers && members.length > 0 ? MEMBER_SEPARATOR : '';
  return `${frame.sharedJson}${separator}${members.join(MEMBER_SEPARATOR)}${SNAPSHOT_AND_MESSAGE_CLOSE}`;
}

/**
 * Sends `snapshot` as a `game_snapshot` to every target, each with its own declared members. Answers the bytes one
 * client was sent — the mean over the targets, a closed socket counting none — which is what `PerformanceTracker`
 * multiplies by the clients.
 */
export function sendSnapshotToViewers(
  game: GameModule,
  targets: readonly Connection[],
  snapshot: GameSnapshot,
): number {
  const { viewerState } = game;
  if (targets.length === 0) return 0;
  if (viewerState === undefined) {
    return broadcastMessage(targets, { type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot });
  }
  const frame = openSnapshotFrame(snapshot, viewerState.keys);
  let totalBytes = 0;
  for (const connection of targets) {
    const message = closeSnapshotFrame(frame, viewerState.serialize(connection.playerId as PlayerId));
    if (sendRaw(connection, message)) totalBytes += message.length;
  }
  return Math.round(totalBytes / targets.length);
}
