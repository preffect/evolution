import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { FIRST_TIER, tierOfRowIndex, tierRowOf } from './trait-tiers.js';

describe('the tier indexing rule', () => {
  it('reads tier I from the first row, the last tier from the last row, and nothing past the table', () => {
    const tiers = DEFAULT_BALANCE.traits.TRAIT_TIERS.nucleoid;
    expect(tierRowOf(tiers, FIRST_TIER)).toBe(tiers[0]);
    expect(tierRowOf(tiers, tiers.length)).toBe(tiers[tiers.length - 1]);
    expect(tierRowOf(tiers, tiers.length + 1)).toBeUndefined();
  });

  it('maps a row index back to its tier', () => {
    expect(tierOfRowIndex(0)).toBe(FIRST_TIER);
    expect(DEFAULT_BALANCE.traits.TRAIT_TIERS.cilia.map((_row, index) => tierOfRowIndex(index))).toEqual([1, 2, 3]);
  });
});
