import { describe, expect, it } from 'vitest';
import { RANDOM_STREAM, RANDOM_STREAM_LABELS, SERVER_RANDOM_STREAM_LABELS } from './stream-labels.js';

describe('RANDOM_STREAM', () => {
  it('lists every label exactly once in declared order', () => {
    expect(RANDOM_STREAM_LABELS).toEqual(Object.values(RANDOM_STREAM));
    expect(new Set(RANDOM_STREAM_LABELS).size).toBe(RANDOM_STREAM_LABELS.length);
  });

  it('uses snake_case wire values', () => {
    for (const label of RANDOM_STREAM_LABELS) {
      expect(label).toMatch(/^[a-z]+(_[a-z]+)*$/);
    }
  });

  it('keeps the cosmetic stream off the server list', () => {
    expect(SERVER_RANDOM_STREAM_LABELS).not.toContain(RANDOM_STREAM.cosmetic);
    expect(SERVER_RANDOM_STREAM_LABELS.length).toBe(RANDOM_STREAM_LABELS.length - 1);
  });
});
