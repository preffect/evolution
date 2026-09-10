import { describe, expect, it } from 'vitest';
import { FNV1A_OFFSET_BASIS, fnv1aFoldByte, fnv1aFoldString, fnv1aFoldUint32 } from './fnv1a.js';

// Known answers from the FNV reference tables (32-bit FNV-1a).
const FNV1A_OF_EMPTY = 0x811c9dc5;
const FNV1A_OF_LOWERCASE_A = 0xe40c292c;
const FNV1A_OF_FOOBAR = 0xbf9cf968;

function fnv1aOfAsciiBytes(text: string): number {
  let hash = FNV1A_OFFSET_BASIS;
  for (let index = 0; index < text.length; index += 1) {
    hash = fnv1aFoldByte(hash, text.charCodeAt(index));
  }
  return hash;
}

describe('fnv1a', () => {
  it('matches the reference vectors for byte folding', () => {
    expect(fnv1aOfAsciiBytes('')).toBe(FNV1A_OF_EMPTY);
    expect(fnv1aOfAsciiBytes('a')).toBe(FNV1A_OF_LOWERCASE_A);
    expect(fnv1aOfAsciiBytes('foobar')).toBe(FNV1A_OF_FOOBAR);
  });

  it('folds only the low byte of a wider value', () => {
    expect(fnv1aFoldByte(FNV1A_OFFSET_BASIS, 0x161)).toBe(fnv1aFoldByte(FNV1A_OFFSET_BASIS, 0x61));
  });

  it('folds a uint32 as four little-endian bytes', () => {
    const viaBytes = [0x78, 0x56, 0x34, 0x12].reduce(fnv1aFoldByte, FNV1A_OFFSET_BASIS);
    expect(fnv1aFoldUint32(FNV1A_OFFSET_BASIS, 0x12345678)).toBe(viaBytes);
  });

  it('folds a string as UTF-16 code units, low byte then high byte', () => {
    const viaBytes = [0x61, 0x00, 0xac, 0x20].reduce(fnv1aFoldByte, FNV1A_OFFSET_BASIS);
    expect(fnv1aFoldString(FNV1A_OFFSET_BASIS, 'a€')).toBe(viaBytes);
  });

  it('always returns an unsigned 32-bit integer', () => {
    const hash = fnv1aFoldString(FNV1A_OFFSET_BASIS, 'determinism');
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(hash)).toBe(true);
  });
});
