import { describe, expect, it } from 'vitest';
import { RANDOM_STREAM, SERVER_RANDOM_STREAM_LABELS } from '@evolution/shared';
import { forkServerStreams, resumeStreams, storeStreams, withStream } from './streams.js';

const SEED = 42;

describe('forkServerStreams', () => {
  it('forks exactly the five server labels, each at position 0', () => {
    const states = forkServerStreams(SEED);
    expect(Object.keys(states).sort()).toEqual([...SERVER_RANDOM_STREAM_LABELS].sort());
    for (const label of SERVER_RANDOM_STREAM_LABELS) expect(states[label].position).toBe(0);
  });

  it('is a pure function of the seed', () => {
    expect(forkServerStreams(SEED)).toEqual(forkServerStreams(SEED));
    expect(forkServerStreams(SEED)).not.toEqual(forkServerStreams(SEED + 1));
  });
});

describe('resumeStreams / storeStreams', () => {
  it('round-trips: draws advance the stored position and the next resume continues the sequence', () => {
    const owner = { random: forkServerStreams(SEED) };
    const live = resumeStreams(owner);
    const first = live[RANDOM_STREAM.spawner].nextFloat();
    storeStreams(owner, live);
    expect(owner.random[RANDOM_STREAM.spawner].position).toBe(1);
    expect(owner.random[RANDOM_STREAM.zones].position).toBe(0);

    const reference = resumeStreams({ random: forkServerStreams(SEED) })[RANDOM_STREAM.spawner];
    expect(reference.nextFloat()).toBe(first);
    expect(resumeStreams(owner)[RANDOM_STREAM.spawner].nextFloat()).toBe(reference.nextFloat());
  });

  it('does not write back until storeStreams is called', () => {
    const owner = { random: forkServerStreams(SEED) };
    resumeStreams(owner)[RANDOM_STREAM.moteMotion].nextFloat();
    expect(owner.random[RANDOM_STREAM.moteMotion].position).toBe(0);
  });
});

describe('withStream', () => {
  it('resumes one stream, returns the draw and writes the state back', () => {
    const owner = { random: forkServerStreams(SEED) };
    const drawn = withStream(owner, RANDOM_STREAM.traitDraft, (random) => random.nextFloat());
    expect(drawn).toBeGreaterThanOrEqual(0);
    expect(owner.random[RANDOM_STREAM.traitDraft].position).toBe(1);
    expect(owner.random[RANDOM_STREAM.spawner].position).toBe(0);
  });
});
