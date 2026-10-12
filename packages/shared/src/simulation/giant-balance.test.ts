// `giantBuildOf` (docs/ecology/giants.md §3.5.4): a species' build read from the live balance as owned traits, the one
// reading the server seats a giant with and the encyclopedia quotes. The rule checks are `constants/giants.test.ts`'s.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, type BalanceConfig } from '../constants/balance.js';
import { GIANT_SPECIES_ORDER } from '../types/game.js';
import { giantBuildOf } from './giant-balance.js';

describe('giantBuildOf', () => {
  it('reads each species’ build, trait for trait and tier for tier, in build order', () => {
    for (const species of GIANT_SPECIES_ORDER) {
      expect(giantBuildOf(species, DEFAULT_BALANCE)).toEqual(DEFAULT_BALANCE.giants.GIANT_BUILDS_BY_SPECIES[species]);
    }
  });

  it('reads the balance it is given, and hands back a copy the caller may keep', () => {
    const balance = structuredClone(DEFAULT_BALANCE) as BalanceConfig;
    const [species] = GIANT_SPECIES_ORDER;
    if (species === undefined) throw new Error('no giant species');
    const build = balance.giants.GIANT_BUILDS_BY_SPECIES[species] as { traitId: string; tier: number }[];
    build.pop();
    const read = giantBuildOf(species, balance);
    expect(read).toHaveLength(build.length);
    expect(read[0]).not.toBe(build[0]);
  });
});
