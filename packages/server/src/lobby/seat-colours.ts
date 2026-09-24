// Seat colours (docs/visual-style/principles-and-palette.md §2): a player's avatar index is its palette, and no two
// players in a room share one (#645). A newcomer keeps the colour it asked for when that is free, else takes the
// lowest free one, so palette index follows seat order. Once every palette is taken (a debug spawn past the seat
// cap) a repeat is unavoidable and the request stands.

import { AVATAR_INDEX_MAX, AVATAR_INDEX_MIN } from '@evolution/shared';

export function freeAvatarIndex(requested: number, taken: Iterable<number>): number {
  const takenIndices = new Set(taken);
  if (!takenIndices.has(requested)) return requested;
  for (let index = AVATAR_INDEX_MIN; index <= AVATAR_INDEX_MAX; index += 1) {
    if (!takenIndices.has(index)) return index;
  }
  return requested;
}

/** The colours the players in a room's roster hold; a player who left keeps its entry but no longer holds it. */
export function seatedColours(room: {
  readonly allPlayerIds: readonly string[];
  readonly avatarAssignments: Readonly<Record<string, number>>;
}): number[] {
  return room.allPlayerIds.flatMap((playerId) => room.avatarAssignments[playerId] ?? []);
}

/** Colours for players seated together, in seat order: each one sees the colours of those before it as taken. */
export function assignSeatColours(
  requests: Iterable<readonly [playerId: string, requested: number]>,
): Record<string, number> {
  const assignments: Record<string, number> = {};
  for (const [playerId, requested] of requests) {
    assignments[playerId] = freeAvatarIndex(requested, Object.values(assignments));
  }
  return assignments;
}
