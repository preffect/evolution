import { describe, expect, it } from 'vitest';
import { createSeededRandom } from './seeded-random.js';
import { forkStreamStates } from './stream-forking.js';
import { RANDOM_STREAM, SERVER_RANDOM_STREAM_LABELS } from './stream-labels.js';

const TEST_SEED = 42;
const PARENT_DRAWS = 3;

describe('forkStreamStates', () => {
  it('returns one fresh state per label, each equal to a direct fork of that label', () => {
    const states = forkStreamStates(createSeededRandom(TEST_SEED), SERVER_RANDOM_STREAM_LABELS);
    expect(Object.keys(states).sort()).toEqual([...SERVER_RANDOM_STREAM_LABELS].sort());
    for (const label of SERVER_RANDOM_STREAM_LABELS) {
      expect(states[label]).toEqual(createSeededRandom(TEST_SEED).fork(label).getState());
      expect(states[label].position).toBe(0);
    }
  });

  it('does not depend on draws the root consumed before forking', () => {
    const busyRoot = createSeededRandom(TEST_SEED);
    for (let draw = 0; draw < PARENT_DRAWS; draw += 1) {
      busyRoot.nextFloat();
    }
    expect(forkStreamStates(busyRoot, SERVER_RANDOM_STREAM_LABELS)).toEqual(
      forkStreamStates(createSeededRandom(TEST_SEED), SERVER_RANDOM_STREAM_LABELS),
    );
  });

  it('gives different states to different labels and different seeds', () => {
    const states = forkStreamStates(createSeededRandom(TEST_SEED), SERVER_RANDOM_STREAM_LABELS);
    const otherSeed = forkStreamStates(createSeededRandom(TEST_SEED + 1), SERVER_RANDOM_STREAM_LABELS);
    expect(states[RANDOM_STREAM.spawner]).not.toEqual(states[RANDOM_STREAM.zones]);
    expect(otherSeed[RANDOM_STREAM.spawner]).not.toEqual(states[RANDOM_STREAM.spawner]);
  });
});
