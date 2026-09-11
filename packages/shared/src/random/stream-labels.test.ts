import { describe, expect, it } from 'vitest';
import {
  COSMETIC_SUB_STREAM,
  RANDOM_STREAM,
  RANDOM_STREAM_LABELS,
  SERVER_RANDOM_STREAM_LABELS,
} from './stream-labels.js';

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

  it('lists every cosmetic sub-stream once, as a snake_case label, with the per-cell fork among them', () => {
    const labels = Object.values(COSMETIC_SUB_STREAM);
    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) expect(label).toMatch(/^[a-z]+(_[a-z]+)*$/);
    expect(labels).toContain(COSMETIC_SUB_STREAM.cell);
    expect(labels).not.toContain(RANDOM_STREAM.cosmetic);
  });

  it('keeps the cosmetic stream off the server list and nothing else', () => {
    expect(SERVER_RANDOM_STREAM_LABELS).not.toContain(RANDOM_STREAM.cosmetic);
    expect([...SERVER_RANDOM_STREAM_LABELS, RANDOM_STREAM.cosmetic]).toEqual(RANDOM_STREAM_LABELS);
  });
});
