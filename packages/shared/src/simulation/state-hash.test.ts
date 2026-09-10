import { describe, expect, it } from 'vitest';
import type { RandomState } from '../random/random-source.js';
import { createSeededRandom } from '../random/seeded-random.js';
import { forkStreamStates } from '../random/stream-forking.js';
import { RANDOM_STREAM, SERVER_RANDOM_STREAM_LABELS, type ServerRandomStreamLabel } from '../random/stream-labels.js';
import {
  type HashedField,
  hashArray,
  hashEnumRecord,
  hashFields,
  hashRandomState,
  hashRandomStreams,
  hashScalarArray,
  hashText,
} from './state-hash.js';
import { StateHasher } from './state-hasher.js';

const TEST_SEED = 42;
const DNA_TAGS = ['motile', 'sturdy', 'photo'] as const;
type DnaTag = (typeof DNA_TAGS)[number];

interface TestCell {
  id: string;
  mass: number;
  isEngulfing: boolean;
  target: number | null;
  dnaTagPoints: Record<DnaTag, number>;
  debugOnly: string;
}

const CELL_FIELDS: readonly HashedField<TestCell>[] = [
  'id',
  'mass',
  'isEngulfing',
  'target',
  { key: 'dnaTagPoints', hash: (hasher, points) => hashEnumRecord(hasher, points, DNA_TAGS) },
];

function createTestCell(overrides: Partial<TestCell> = {}): TestCell {
  return {
    id: 'c-1',
    mass: 40,
    isEngulfing: false,
    target: null,
    dnaTagPoints: { motile: 1, sturdy: 2, photo: 3 },
    debugOnly: 'ignored',
    ...overrides,
  };
}

function hashCell(cell: TestCell): string {
  const hasher = new StateHasher();
  hashFields(hasher, cell, CELL_FIELDS);
  return hasher.digest();
}

function hashCells(cells: readonly TestCell[]): string {
  const hasher = new StateHasher();
  hashArray(hasher, cells, (itemHasher, cell) => hashFields(itemHasher, cell, CELL_FIELDS));
  return hasher.digest();
}

describe('hashFields', () => {
  it('hashes equal records equal', () => {
    expect(hashCell(createTestCell())).toBe(hashCell(createTestCell()));
  });

  it('changes when any listed field changes', () => {
    const base = hashCell(createTestCell());
    expect(hashCell(createTestCell({ id: 'c-2' }))).not.toBe(base);
    expect(hashCell(createTestCell({ mass: 41 }))).not.toBe(base);
    expect(hashCell(createTestCell({ isEngulfing: true }))).not.toBe(base);
    expect(hashCell(createTestCell({ target: 0 }))).not.toBe(base);
    expect(hashCell(createTestCell({ dnaTagPoints: { motile: 1, sturdy: 3, photo: 2 } }))).not.toBe(base);
  });

  it('ignores fields that are not listed', () => {
    expect(hashCell(createTestCell({ debugOnly: 'other' }))).toBe(hashCell(createTestCell()));
  });
});

describe('hashEnumRecord', () => {
  it('walks the declared enum order regardless of the record key order', () => {
    const declared: Record<DnaTag, number> = { motile: 1, sturdy: 2, photo: 3 };
    const reordered: Record<DnaTag, number> = { photo: 3, sturdy: 2, motile: 1 };
    const hashDeclared = new StateHasher();
    const hashReordered = new StateHasher();
    hashEnumRecord(hashDeclared, declared, DNA_TAGS);
    hashEnumRecord(hashReordered, reordered, DNA_TAGS);
    expect(hashDeclared.digest()).toBe(hashReordered.digest());
  });
});

describe('hashArray', () => {
  it('changes when items are reordered, added or removed', () => {
    const first = createTestCell({ id: 'c-1' });
    const second = createTestCell({ id: 'c-2' });
    const base = hashCells([first, second]);
    expect(hashCells([second, first])).not.toBe(base);
    expect(hashCells([first])).not.toBe(base);
    expect(hashCells([first, second, createTestCell({ id: 'c-3' })])).not.toBe(base);
  });

  it('distinguishes an empty array from no array', () => {
    const withEmpty = new StateHasher();
    hashScalarArray(withEmpty, []);
    expect(withEmpty.digest()).not.toBe(new StateHasher().digest());
  });
});

describe('hashRandomState / hashRandomStreams', () => {
  function forkAllStreams(seed: number): Record<ServerRandomStreamLabel, RandomState> {
    return forkStreamStates(createSeededRandom(seed), SERVER_RANDOM_STREAM_LABELS);
  }

  function hashStreams(streams: Record<ServerRandomStreamLabel, RandomState>): string {
    const hasher = new StateHasher();
    hashRandomStreams(hasher, streams, SERVER_RANDOM_STREAM_LABELS);
    return hasher.digest();
  }

  it('changes when a stream consumes a draw', () => {
    const stream = createSeededRandom(TEST_SEED);
    const before = new StateHasher();
    hashRandomState(before, stream.getState());
    stream.nextFloat();
    const after = new StateHasher();
    hashRandomState(after, stream.getState());
    expect(before.digest()).not.toBe(after.digest());
  });

  it('hashes the same forked streams equal and a different seed different', () => {
    expect(hashStreams(forkAllStreams(TEST_SEED))).toBe(hashStreams(forkAllStreams(TEST_SEED)));
    expect(hashStreams(forkAllStreams(TEST_SEED + 1))).not.toBe(hashStreams(forkAllStreams(TEST_SEED)));
  });

  it('changes when one stream advances', () => {
    const streams = forkAllStreams(TEST_SEED);
    const base = hashStreams(streams);
    const spawner = createSeededRandom(streams[RANDOM_STREAM.spawner].seed);
    spawner.nextFloat();
    expect(hashStreams({ ...streams, [RANDOM_STREAM.spawner]: spawner.getState() })).not.toBe(base);
  });
});

describe('hashText', () => {
  it('hashes equal text equal and different text different', () => {
    expect(hashText('{"tick":1}')).toBe(hashText('{"tick":1}'));
    expect(hashText('{"tick":1}')).not.toBe(hashText('{"tick":2}'));
  });
});
