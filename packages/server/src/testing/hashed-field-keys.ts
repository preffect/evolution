// The field names a `HashedField` list walks, sorted (docs/determinism/ordering-and-state-hash.md §5): what the state
// hash's pin tests compare with the keys of a real record, so a field the record gains is hashed or fails the pin.

import type { HashedField } from '@evolution/shared';

/** The names `fields` walks: a scalar's own name, a nested field's `key`, sorted. */
export function hashedFieldKeys<Record>(fields: readonly HashedField<Record>[]): string[] {
  return fields.map((field) => (typeof field === 'string' ? field : (field as { key: string }).key)).sort();
}
