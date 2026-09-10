// FNV-1a, 32-bit: the byte-fold primitive behind fork-label seeding (random/label-hash.ts)
// and the state hash lanes (simulation/state-hasher.ts). One home, two callers
// (docs/CODE-STANDARDS.md §3).

/** The standard 32-bit FNV-1a offset basis. */
export const FNV1A_OFFSET_BASIS = 0x811c9dc5;
/** The standard 32-bit FNV prime. */
export const FNV1A_PRIME = 0x01000193;

const BYTE_MASK = 0xff;
const BITS_PER_BYTE = 8;
const BYTES_PER_UINT32 = 4;

/** Folds one byte into a running FNV-1a hash. Returns an unsigned 32-bit integer. */
export function fnv1aFoldByte(hash: number, byte: number): number {
  return Math.imul(hash ^ (byte & BYTE_MASK), FNV1A_PRIME) >>> 0;
}

/** Folds the four little-endian bytes of an unsigned 32-bit integer. */
export function fnv1aFoldUint32(hash: number, value: number): number {
  let folded = hash;
  for (let byteIndex = 0; byteIndex < BYTES_PER_UINT32; byteIndex += 1) {
    folded = fnv1aFoldByte(folded, value >>> (byteIndex * BITS_PER_BYTE));
  }
  return folded;
}

/** Folds a string as UTF-16 code units, each as its low byte then its high byte. */
export function fnv1aFoldString(hash: number, text: string): number {
  let folded = hash;
  for (let index = 0; index < text.length; index += 1) {
    const codeUnit = text.charCodeAt(index);
    folded = fnv1aFoldByte(folded, codeUnit);
    folded = fnv1aFoldByte(folded, codeUnit >>> BITS_PER_BYTE);
  }
  return folded;
}
