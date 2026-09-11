// docs/ECOLOGY.md §8 and docs/ARCHITECTURE.md §8: a fixture or debug grant checked against the catalog.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '@evolution/shared';
import { toOwnedTraits, UnknownTraitError } from './owned-traits.js';

const catalog = DEFAULT_BALANCE.traits.TRAIT_CATALOG;
const TOP_TIER = DEFAULT_BALANCE.traits.TRAIT_TIER_COUNT;

describe('toOwnedTraits', () => {
  it('grants tier I when no tier is named, in the given order', () => {
    expect(toOwnedTraits(catalog, [{ traitId: 'cell_wall' }, { traitId: 'cilia' }])).toEqual([
      { traitId: 'cell_wall', tier: 1 },
      { traitId: 'cilia', tier: 1 },
    ]);
  });

  it('grants an explicit tier up to the top one', () => {
    expect(toOwnedTraits(catalog, [{ traitId: 'cilia', tier: 2 }])).toEqual([{ traitId: 'cilia', tier: 2 }]);
    expect(toOwnedTraits(catalog, [{ traitId: 'cilia', tier: TOP_TIER }])).toEqual([
      { traitId: 'cilia', tier: TOP_TIER },
    ]);
  });

  it('refuses an id that is not in the catalog', () => {
    expect(() => toOwnedTraits(catalog, [{ traitId: 'jet_siphon' }])).toThrow(UnknownTraitError);
    expect(() => toOwnedTraits(catalog, [{ traitId: 'jet_siphon' }])).toThrow('"jet_siphon" is not a catalog trait');
  });

  it.each([0, TOP_TIER + 1, 1.5, -1])('refuses tier %s with the tier range in the message', (tier) => {
    expect(() => toOwnedTraits(catalog, [{ traitId: 'cilia', tier }])).toThrow(UnknownTraitError);
    expect(() => toOwnedTraits(catalog, [{ traitId: 'cilia', tier }])).toThrow(
      `trait cilia has tiers 1 to ${TOP_TIER}, got tier ${tier}`,
    );
  });

  it('is empty for no grants', () => {
    expect(toOwnedTraits(catalog, [])).toEqual([]);
  });
});
