// Seat colours (docs/visual-style/principles-and-palette.md §2): a player's avatar index is its palette, and no two
// players in a room share one while a colour is free (#645). A newcomer keeps the colour it asked for when that is
// free, else takes the lowest free one, so palette index follows seat order. Bots do not count toward the human seat
// cap, so a room can hold more players than colours (a human joining 1 human + 7 bots, or bots past the cap); then a
// repeat is unavoidable and the newcomer takes the least-held colour, so repeats spread instead of piling on one.

import { AVATAR_INDEX_MAX, AVATAR_INDEX_MIN } from '@evolution/shared';

/**
 * The colour a newcomer asking for `requested` gets beside the players holding `taken`: `requested` when no one
 * holds it, else the least-held colour (lowest index on a tie), which is the lowest free one while any is free.
 */
export function freeAvatarIndex(requested: number, taken: Iterable<number>): number {
  const holders = new Map<number, number>();
  for (const index of taken) holders.set(index, (holders.get(index) ?? 0) + 1);
  if (!holders.has(requested)) return requested;
  let leastHeld = AVATAR_INDEX_MIN;
  for (let index = AVATAR_INDEX_MIN; index <= AVATAR_INDEX_MAX; index += 1) {
    if ((holders.get(index) ?? 0) < (holders.get(leastHeld) ?? 0)) leastHeld = index;
  }
  return leastHeld;
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
