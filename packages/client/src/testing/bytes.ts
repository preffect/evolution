// Test support (docs/testing/tiers-and-builders.md §4): byte-array equality for the baked noise textures. `toEqual`
// on a typed array walks every element through the deep matcher (~200 ms for the 16 KB strip,
// #226); a typed-array walk is under a millisecond.

/** `true` when both arrays hold the same bytes in the same order. */
export function areBytesEqual(first: Uint8Array, second: Uint8Array): boolean {
  return first.length === second.length && first.every((byte, index) => byte === second[index]);
}

/** FNV-1a's 32-bit offset basis and prime: the hash below is the standard one, not a choice of ours. */
const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;
const HEX = 16;

/**
 * A bake's FNV-1a checksum, as hex. A spec pins this to hold a bake's **bytes** fixed across a
 * refactor of how they are computed (docs/DETERMINISM.md): a changed byte anywhere changes the digest,
 * where `areBytesEqual` against a second call of the same code would not notice (ticket #442).
 */
export function bytesChecksum(bytes: Uint8Array): string {
  let hash = FNV_OFFSET_BASIS;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0).toString(HEX);
}
