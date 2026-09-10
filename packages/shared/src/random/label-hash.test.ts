import { describe, expect, it } from 'vitest';
import { hashLabel } from './label-hash.js';
import { RANDOM_STREAM, RANDOM_STREAM_LABELS } from './stream-labels.js';

// Known answers from an independent Python FNV-1a implementation (parent seed as four
// little-endian bytes, then the label's UTF-16 code units low byte first).
const PARENT_SEED = 42;
const HASH_42_SPAWNER = 3705278747;
const HASH_42_ZONES = 489298018;
const HASH_0_EMPTY = 1268118805;

describe('hashLabel', () => {
  it('matches the reference vectors', () => {
    expect(hashLabel(PARENT_SEED, RANDOM_STREAM.spawner)).toBe(HASH_42_SPAWNER);
    expect(hashLabel(PARENT_SEED, RANDOM_STREAM.zones)).toBe(HASH_42_ZONES);
    expect(hashLabel(0, '')).toBe(HASH_0_EMPTY);
  });

  it('gives every stream label a distinct child seed under one parent', () => {
    const seeds = RANDOM_STREAM_LABELS.map((label) => hashLabel(PARENT_SEED, label));
    expect(new Set(seeds).size).toBe(RANDOM_STREAM_LABELS.length);
  });

  it('changes with the parent seed', () => {
    expect(hashLabel(PARENT_SEED, RANDOM_STREAM.spawner)).not.toBe(hashLabel(PARENT_SEED + 1, RANDOM_STREAM.spawner));
  });
});
