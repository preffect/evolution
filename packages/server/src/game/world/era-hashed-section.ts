// The eras' section of the state hash (docs/determinism/ordering-and-state-hash.md §5): the era the world has moved
// into, the eras' random streams and the pool's own state, walked after the held lists and only once the world has
// some of it. Every world that never reaches the pool (every world while the eras are off) therefore hashes byte for
// byte as before the eras (#931), though it carries the eras' streams from creation (#932). The section opens with a
// string's tag where the held lists open with an array's, so either section's presence reads from its first byte.
// Every field is listed and `state-hash.test.ts` pins it; a field added to the eras' state goes here, in this one
// section and under this one gate, never in a third trailing section.

import {
  ERA_RANDOM_STREAM_LABELS,
  GAME_ERA,
  hashArray,
  hashFields,
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
import type { WorldState } from './world-state.js';

export const POOL_FILM_HASHED_FIELDS: readonly HashedField<PoolFilmView>[] = ['x', 'y', 'radius'];
export const POOL_THREAD_HASHED_FIELDS: readonly HashedField<PoolThreadView>[] = [
  'startX',
  'startY',
  'endX',
  'endY',
  'width',
];
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

/** The pool's own state on the world: null in every world that has not drawn it. */
const POOL_STATE_FIELDS = ['poolLayout', 'surge', 'copepodLane'] as const;

/** The world fields the section walks, in walk order (the eras' streams are walked between the first and the rest). */
export const TRAILING_WORLD_HASHED_FIELDS = ['eraMovedInto', ...POOL_STATE_FIELDS] as const;

function hashNullable<Value>(hasher: StateHasher, value: Value | null, fields: readonly HashedField<Value>[]): void {
  if (value === null) {
    hasher.hashNull();
  } else {
    hashFields(hasher, value, fields);
  }
}

/**
 * True once the world has era state: it has left the dish, drawn from one of the eras' streams (a stream's state is
 * hashed only once drawn, so adding the streams moved no hash) or holds some of the pool's state.
 */
export function hasEraState(world: WorldState): boolean {
  return (
    world.eraMovedInto !== GAME_ERA.dish ||
    ERA_RANDOM_STREAM_LABELS.some((label) => world.random[label].position > 0) ||
    POOL_STATE_FIELDS.some((field) => world[field] !== null)
  );
}

/** The eras' section, the walk's last: nothing at all for a world without era state. */
export function hashEraSection(hasher: StateHasher, world: WorldState): void {
  if (!hasEraState(world)) return;
  hasher.hashString(world.eraMovedInto);
  hashRandomStreams(hasher, world.random, ERA_RANDOM_STREAM_LABELS);
  hashNullable(hasher, world.poolLayout, POOL_LAYOUT_HASHED_FIELDS);
  hashNullable(hasher, world.surge, SURGE_HASHED_FIELDS);
  hashNullable(hasher, world.copepodLane, COPEPOD_LANE_HASHED_FIELDS);
}
