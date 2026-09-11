// Test support (docs/TESTING.md §4): byte-array equality for the baked noise textures. `toEqual`
// on a typed array walks every element through the deep matcher (~200 ms for the 16 KB strip,
// #226); a typed-array walk is under a millisecond.

/** `true` when both arrays hold the same bytes in the same order. */
export function areBytesEqual(first: Uint8Array, second: Uint8Array): boolean {
  return first.length === second.length && first.every((byte, index) => byte === second[index]);
}
