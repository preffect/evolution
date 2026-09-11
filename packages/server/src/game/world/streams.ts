// The stored stream states become live sources for one step and are written back after it
// (docs/DETERMINISM.md §3). The resume-and-write-back happens here and in step.ts only; a system
// never touches `world.random`. Between ticks (a late join, a debug spawn) the module resumes one
// stream through `withStream`, which writes back before returning.

import {
  createSeededRandom,
  createSeededRandomFromState,
  forkStreamStates,
  SERVER_RANDOM_STREAM_LABELS,
  type RandomSource,
  type RandomState,
  type ServerRandomStreamLabel,
} from '@evolution/shared';

export type StreamStates = Record<ServerRandomStreamLabel, RandomState>;
export type LiveStreams = Record<ServerRandomStreamLabel, RandomSource>;

export interface StreamOwner {
  random: StreamStates;
}

/** Forks the five server streams from a round seed: what `createWorld` and `debug_set_seed` store. */
export function forkServerStreams(seed: number): StreamStates {
  return forkStreamStates(createSeededRandom(seed), SERVER_RANDOM_STREAM_LABELS);
}

export function resumeStreams(owner: StreamOwner): LiveStreams {
  const live: Partial<LiveStreams> = {};
  for (const label of SERVER_RANDOM_STREAM_LABELS) {
    live[label] = createSeededRandomFromState(owner.random[label]);
  }
  return live as LiveStreams;
}

export function storeStreams(owner: StreamOwner, live: LiveStreams): void {
  for (const label of SERVER_RANDOM_STREAM_LABELS) {
    owner.random[label] = live[label].getState();
  }
}

/** Resumes one stream, runs `draw` with it and writes its state back. */
export function withStream<Result>(
  owner: StreamOwner,
  label: ServerRandomStreamLabel,
  draw: (random: RandomSource) => Result,
): Result {
  const random = createSeededRandomFromState(owner.random[label]);
  const result = draw(random);
  owner.random[label] = random.getState();
  return result;
}
