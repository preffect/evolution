// The canonical walk helpers behind `computeStateHash` (docs/DETERMINISM.md §5): records by a
// declared field list, closed-enum records by the enum's declared array, arrays in order.
// Never `Object.keys`. `computeStateHash(world)` composes these over `HASHED_FIELDS` once the
// world state lands (#98); until then the echo harness hashes text through `hashText`.

import type { RandomState } from '../random/random-source.js';
import { type HashableScalar, type StateHash, StateHasher } from './state-hasher.js';

/** Feeds one value of a record field into the hasher. */
export type ValueHasher<T> = (hasher: StateHasher, value: T) => void;

/**
 * One entry of a `HASHED_FIELDS` list: a scalar field by name, or a nested field paired with
 * the hasher that walks it. Listing a field with the wrong shape is a type error.
 */
export type HashedField<T> = {
  [Key in keyof T & string]: T[Key] extends HashableScalar
    ? Key
    : { readonly key: Key; readonly hash: ValueHasher<T[Key]> };
}[keyof T & string];

/** Hashes `record`'s fields in the order `fields` declares; fields not listed are not hashed. */
export function hashFields<T>(hasher: StateHasher, record: T, fields: readonly HashedField<T>[]): void {
  // `HashedField<T>` proves a string entry names a scalar field and an object entry carries
  // the hasher for its field's type; the casts only restate that proof where TypeScript cannot
  // carry the mapped-type relation through the loop.
  for (const field of fields) {
    if (typeof field === 'string') {
      hasher.hashScalar(record[field as keyof T] as HashableScalar);
    } else {
      const nested = field as { key: keyof T; hash: ValueHasher<T[keyof T]> };
      nested.hash(hasher, record[nested.key]);
    }
  }
}

/** Hashes an array in order, length first, each item through `hashItem`. */
export function hashArray<T>(hasher: StateHasher, items: readonly T[], hashItem: ValueHasher<T>): void {
  hasher.hashArrayLength(items.length);
  for (const item of items) {
    hashItem(hasher, item);
  }
}

/** Hashes a record keyed by a closed enum in the enum's declared order. */
export function hashEnumRecord<Key extends string>(
  hasher: StateHasher,
  record: Readonly<Record<Key, HashableScalar>>,
  keyOrder: readonly Key[],
): void {
  hashArray(hasher, keyOrder, (itemHasher, key) => {
    itemHasher.hashScalar(record[key]);
  });
}

/** Hashes an array of scalars in order. */
export function hashScalarArray(hasher: StateHasher, items: readonly HashableScalar[]): void {
  hashArray(hasher, items, (itemHasher, item) => {
    itemHasher.hashScalar(item);
  });
}

/** Hashes a stream's serialisable state (seed, position, words), for `world.random`. */
export function hashRandomState(hasher: StateHasher, state: RandomState): void {
  hashFields(hasher, state, ['seed', 'position', { key: 'words', hash: hashScalarArray }]);
}

/** Hashes the record of streams in `labelOrder` (the `SERVER_RANDOM_STREAM_LABELS` walk). */
export function hashRandomStreams<Label extends string>(
  hasher: StateHasher,
  streams: Readonly<Record<Label, RandomState>>,
  labelOrder: readonly Label[],
): void {
  hashArray(hasher, labelOrder, (itemHasher, label) => {
    hashRandomState(itemHasher, streams[label]);
  });
}

/** The hash of a text (the echo harness hashes `JSON.stringify(serializeRoomState())`). */
export function hashText(text: string): StateHash {
  return new StateHasher().hashString(text).digest();
}
