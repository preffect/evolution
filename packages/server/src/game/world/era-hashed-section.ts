// The eras' section of the state hash (docs/determinism/ordering-and-state-hash.md §5): the era the world has moved
// into, the eras' random streams and the pool's own state, walked after the held lists and only once the world has
// some of it. Every world that never reaches the pool (every world while the eras are off) therefore hashes byte for
// byte as before the eras (#931), though it carries the eras' streams from creation (#932). The section opens with a
// string's tag where the held lists open with an array's, so either section's presence reads from its first byte.
// The pool's state is one list, `POOL_STATE_HASHED_FIELDS`, which the gate and the walk both iterate, so a field is
// gated exactly when it is walked; a field added to the eras' state joins that list, in this one section and under
// this one gate, never in a third trailing section.

import {
  ERA_RANDOM_STREAM_LABELS,
  GAME_ERA,
  hashArray,
  hashFields,
  hashNullable,
  hashRandomStreams,
  type CopepodLaneView,
  type HashedField,
  type LightPatchOrbitView,
  type PoolFilmView,
  type PoolLayoutView,
  type PoolThreadView,
  type StateHasher,
  type SurgeView,
} from '@evolution/shared';
import type { PoolCreatureSeatRecord } from './entities.js';
import { POOL_CREATURE_SEAT_HASHED_FIELDS } from './seat-hashed-fields.js';
import type { WorldState } from './world-state.js';

export const POOL_FILM_HASHED_FIELDS: readonly HashedField<PoolFilmView>[] = ['x', 'y'];
export const POOL_THREAD_HASHED_FIELDS: readonly HashedField<PoolThreadView>[] = ['x', 'y', 'angleRadians'];
export const LIGHT_PATCH_ORBIT_HASHED_FIELDS: readonly HashedField<LightPatchOrbitView>[] = [
  'orbitRadius',
  'startAngleRadians',
  'startTick',
];
export const POOL_LAYOUT_HASHED_FIELDS: readonly HashedField<PoolLayoutView>[] = [
  {
    key: 'films',
    hash: (hasher, films) =>
      hashArray(hasher, films, (filmHasher, film) => hashFields(filmHasher, film, POOL_FILM_HASHED_FIELDS)),
  },
  {
    key: 'threads',
    hash: (hasher, threads) =>
      hashArray(hasher, threads, (threadHasher, thread) => hashFields(threadHasher, thread, POOL_THREAD_HASHED_FIELDS)),
  },
  { key: 'lightPatchOrbit', hash: (hasher, orbit) => hashFields(hasher, orbit, LIGHT_PATCH_ORBIT_HASHED_FIELDS) },
];
export const SURGE_HASHED_FIELDS: readonly HashedField<SurgeView>[] = ['startedAtTick', 'directionX', 'directionY'];
export const COPEPOD_LANE_HASHED_FIELDS: readonly HashedField<CopepodLaneView>[] = [
  'startX',
  'startY',
  'directionX',
  'directionY',
  'startedAtTick',
];

/** The seats in seat order, or null's marker for a world without creatures. */
function hashPoolCreatureSeats(hasher: StateHasher, seats: readonly PoolCreatureSeatRecord[] | null): void {
  if (seats === null) {
    hasher.hashNull();
    return;
  }
  hashArray(hasher, seats, (seatHasher, seat) => hashFields(seatHasher, seat, POOL_CREATURE_SEAT_HASHED_FIELDS));
}

/**
 * The pool's own state on the world, in walk order: each field is null in a world that has none of it, and is walked as
 * null's marker or its fields. The gate (`hasEraState`) and the walk (`hashEraSection`) both iterate this list.
 */
export const POOL_STATE_HASHED_FIELDS = [
  { key: 'poolLayout', hash: (hasher, layout) => hashNullable(hasher, layout, POOL_LAYOUT_HASHED_FIELDS) },
  { key: 'surge', hash: (hasher, surge) => hashNullable(hasher, surge, SURGE_HASHED_FIELDS) },
  { key: 'copepodLane', hash: (hasher, lane) => hashNullable(hasher, lane, COPEPOD_LANE_HASHED_FIELDS) },
  { key: 'poolCreatureSeats', hash: hashPoolCreatureSeats },
] as const satisfies readonly HashedField<WorldState>[];

/** The world fields the section walks, in walk order (the eras' streams are walked between the first and the rest). */
export const TRAILING_WORLD_HASHED_FIELDS = [
  'eraMovedInto',
  ...POOL_STATE_HASHED_FIELDS.map((field) => field.key),
] as const;

/**
 * True once the world has era state: it has left the dish, drawn from one of the eras' streams (a stream's state is
 * hashed only once drawn, so adding the streams moved no hash) or holds some of the pool's state.
 */
export function hasEraState(world: WorldState): boolean {
  return (
    world.eraMovedInto !== GAME_ERA.dish ||
    ERA_RANDOM_STREAM_LABELS.some((label) => world.random[label].position > 0) ||
    POOL_STATE_HASHED_FIELDS.some((field) => world[field.key] !== null)
  );
}

/** The eras' section, the walk's last: nothing at all for a world without era state. */
export function hashEraSection(hasher: StateHasher, world: WorldState): void {
  if (!hasEraState(world)) return;
  hasher.hashString(world.eraMovedInto);
  hashRandomStreams(hasher, world.random, ERA_RANDOM_STREAM_LABELS);
  hashFields(hasher, world, POOL_STATE_HASHED_FIELDS);
}
