// Fork-label seeding (docs/DETERMINISM.md §3): a child stream's seed is FNV-1a over the parent
// seed's bytes and the label's UTF-16 code units, never a draw from the parent's sequence.

import { FNV1A_OFFSET_BASIS, fnv1aFoldString, fnv1aFoldUint32 } from '../hashing/fnv1a.js';

/** Derives the seed of the child stream `label` under `parentSeed`. Unsigned 32-bit. */
export function hashLabel(parentSeed: number, label: string): number {
  const withParent = fnv1aFoldUint32(FNV1A_OFFSET_BASIS, parentSeed);
  return fnv1aFoldString(withParent, label);
}
