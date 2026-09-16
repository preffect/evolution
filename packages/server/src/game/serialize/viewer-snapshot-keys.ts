// How a `GameSnapshot` splits between what every viewer is sent alike and what each viewer is sent apart
// (docs/architecture/wire-contract.md §4, §4.2 lever 1). A file of its own, so the broadcast serializer and the viewer
// state both read the split without importing each other.

import type { GameSnapshot } from '@evolution/shared';

/** The snapshot members only their viewer is sent, in the order the room appends them. */
export const VIEWER_SNAPSHOT_KEYS = [
  'food',
  'dnaFragments',
  'ownProgress',
  'appliedInputSequenceByPlayer',
] as const satisfies readonly (keyof GameSnapshot)[];

export type ViewerSnapshotKey = (typeof VIEWER_SNAPSHOT_KEYS)[number];

/** One viewer's values for `VIEWER_SNAPSHOT_KEYS`. */
export type ViewerSnapshotMembers = Pick<GameSnapshot, ViewerSnapshotKey>;

/** `serializeRoomState`'s answer: the snapshot every viewer is sent alike, with no member of `VIEWER_SNAPSHOT_KEYS` (#399). */
export type BroadcastSnapshot = Omit<GameSnapshot, ViewerSnapshotKey>;
