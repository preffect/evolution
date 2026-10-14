// The seats' hashed fields (docs/determinism/ordering-and-state-hash.md §5): what `computeStateHash` walks of each wild
// and giant seat (docs/ecology/wild-cells.md §3.3, docs/ecology/giants.md §3.5.9), and what the eras' section walks of
// each pool creature's seat (docs/game-design/phases.md §14.6). The seat record is the whole of a seated cell's memory,
// so every field is listed; `state-hash.test.ts` and `era-hashed-section.test.ts` pin it.

import type { HashedField } from '@evolution/shared';
import type { GiantSeatRecord, PoolCreatureSeatRecord, SeatMindRecord, WildSeatRecord } from './entities.js';

/** What every seat with a mind keeps (`SeatMindRecord`): the head of the wild and the giant seats' lists. */
export const SEAT_MIND_HASHED_FIELDS = [
  'seatNumber',
  'cellId',
  'grownMass',
  'fullMass',
  'respawnInTicks',
  'headingX',
  'headingY',
  'decideInTicks',
  'huntPreyId',
  'huntStartTick',
  'givenUpPreyId',
  'huntRestUntilTick',
] as const satisfies readonly HashedField<SeatMindRecord>[];

export const WILD_SEAT_HASHED_FIELDS: readonly HashedField<WildSeatRecord>[] = [
  ...SEAT_MIND_HASHED_FIELDS,
  'sizeFactor',
  'isStarving',
];

/** A pool creature's seat: its mind, then what the creature is (its cell's `poolCreature` mirrors it, derived). */
export const POOL_CREATURE_SEAT_HASHED_FIELDS: readonly HashedField<PoolCreatureSeatRecord>[] = [
  ...SEAT_MIND_HASHED_FIELDS,
  'species',
  'isLandmark',
];

export const GIANT_SEAT_HASHED_FIELDS: readonly HashedField<GiantSeatRecord>[] = [
  ...SEAT_MIND_HASHED_FIELDS,
  'species',
  'bornMass',
];
