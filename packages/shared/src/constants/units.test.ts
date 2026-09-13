import { describe, expect, it } from 'vitest';
import { BYTES_PER_KIBIBYTE, BYTES_PER_MEBIBYTE, MILLISECONDS_PER_SECOND, SECONDS_PER_MINUTE } from './units.js';

describe('unit factors', () => {
  it('derives the mebibyte from the kibibyte', () => {
    expect(BYTES_PER_MEBIBYTE).toBe(BYTES_PER_KIBIBYTE * BYTES_PER_KIBIBYTE);
  });

  it('keeps the SI second', () => {
    expect(MILLISECONDS_PER_SECOND).toBe(1000);
  });

  it('keeps the minute the HUD clock formats against', () => {
    expect(SECONDS_PER_MINUTE).toBe(60);
  });
});
