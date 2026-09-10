// Forks the labelled streams from a root source (docs/DETERMINISM.md §3): the one place that
// turns a seed into `world.random`, used by `createWorld` and by the tests that model it.

import type { RandomSource, RandomState } from './random-source.js';

/**
 * Forks one child per label from `root` and returns their serialisable states keyed by label.
 * The order of `labels` is the fork order; each child depends only on the root seed and its
 * label, never on the root's draws or on its siblings.
 */
export function forkStreamStates<Label extends string>(
  root: RandomSource,
  labels: readonly Label[],
): Record<Label, RandomState> {
  const states: Partial<Record<Label, RandomState>> = {};
  for (const label of labels) {
    states[label] = root.fork(label).getState();
  }
  // Every label was assigned above, so the partial record is complete.
  return states as Record<Label, RandomState>;
}
