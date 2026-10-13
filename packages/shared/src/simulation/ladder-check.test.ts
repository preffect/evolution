// `ladderProblem` (docs/ecology/wild-cells.md §3.3, docs/ecology/giants.md §3.5.14): the one valid-ladder rule the wild
// builds and the giant builds keep. Each rule goes red on a build that breaks it, and only on that build.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import type { TraitId } from '../types/game.js';
import { ladderProblem } from './ladder-check.js';

/** The amoeba's climb (wild build 0's first five picks): a valid ladder ending in a body plan. */
const AMOEBA_CLIMB: readonly TraitId[] = [
  'nucleoid',
  'mitochondrion',
  'nuclear_envelope',
  'cytoskeleton',
  'amoeba_pseudopods',
];

describe('ladderProblem', () => {
  it('accepts a valid ladder and the empty build', () => {
    expect(ladderProblem(AMOEBA_CLIMB, DEFAULT_BALANCE)).toBeNull();
    expect(ladderProblem([], DEFAULT_BALANCE)).toBeNull();
  });

  it('accepts a second body plan’s requirement while the build owns only one body plan', () => {
    expect(ladderProblem([...AMOEBA_CLIMB, 'cilia'], DEFAULT_BALANCE)).toBeNull();
  });

  it.each([
    ['a trait not in the catalog', ['nucleoid', 'no_such_trait'], /no_such_trait is not in the trait catalog/],
    ['a repeated trait', ['nucleoid', 'nucleoid'], /nucleoid is listed twice/],
    ['a trait before the stage it needs', ['nuclear_envelope'], /nuclear_envelope needs stage/],
    [
      'a missing requirement',
      AMOEBA_CLIMB.filter((traitId) => traitId !== 'cytoskeleton'),
      /amoeba_pseudopods requires cytoskeleton before it/,
    ],
    [
      'two body plans',
      [...AMOEBA_CLIMB, 'cilia', 'paramecium_cilia'],
      /paramecium_cilia shares exclusion group body_plan with amoeba_pseudopods/,
    ],
  ])('refuses %s', (_rule, build, message) => {
    expect(ladderProblem(build as readonly TraitId[], DEFAULT_BALANCE)).toMatch(message);
  });

  it('refuses two membranes, reading the groups from the balance it is given', () => {
    const balance = structuredClone(DEFAULT_BALANCE);
    const cilia = balance.traits.TRAIT_CATALOG.find((trait) => trait.id === 'cilia');
    Object.assign(cilia!, { exclusionGroup: 'membrane' });
    const build: readonly TraitId[] = ['nucleoid', 'cell_wall', 'mitochondrion', 'nuclear_envelope', 'cilia'];
    expect(ladderProblem(build, DEFAULT_BALANCE)).toBeNull();
    expect(ladderProblem(build, balance)).toMatch(/cilia shares exclusion group membrane with cell_wall/);
  });
});
