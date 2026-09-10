import { describe, expect, it } from 'vitest';
import { BYTES_PER_KIBIBYTE, BYTES_PER_MEBIBYTE, MILLISECONDS_PER_SECOND } from './units.js';

describe('unit factors', () => {
  it('derives the mebibyte from the kibibyte', () => {
    expect(BYTES_PER_MEBIBYTE).toBe(BYTES_PER_KIBIBYTE * BYTES_PER_KIBIBYTE);
  });

  it('keeps the SI second', () => {
    expect(MILLISECONDS_PER_SECOND).toBe(1000);
  });
});
