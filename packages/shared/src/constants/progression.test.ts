import { describe, expect, it } from 'vitest';
import { DNA_TAG } from '../types/game.js';
import { TRAIT_RARITY } from '../types/traits.js';
import { CELL_STARTING_MASS } from './growth.js';
import {
  DNA_TAGS,
  ENTRY_MASS_FRACTION,
  ENTRY_MAX_MASS,
  RARITY_WEIGHT,
  TAG_WEIGHT_MAX_MULTIPLIER,
  TAG_WEIGHT_PER_POINT,
} from './progression.js';

/** docs/PROGRESSION.md §3: a rare with no tag support is 20 % as likely as a common. */
const RARE_TO_COMMON_RATIO = 0.2;
/** docs/PROGRESSION.md P4: 30 motile points saturate the tag multiplier. */
const SATURATING_TAG_POINTS = 30;

describe('progression tables', () => {
  it('walks every DNA tag exactly once', () => {
    expect([...DNA_TAGS].sort()).toEqual(Object.values(DNA_TAG).sort());
    expect(new Set(DNA_TAGS).size).toBe(DNA_TAGS.length);
  });

  it('weights rarities common > uncommon > rare, rare at a fifth of common', () => {
    expect(RARITY_WEIGHT[TRAIT_RARITY.common]).toBeGreaterThan(RARITY_WEIGHT[TRAIT_RARITY.uncommon]);
    expect(RARITY_WEIGHT[TRAIT_RARITY.uncommon]).toBeGreaterThan(RARITY_WEIGHT[TRAIT_RARITY.rare]);
    expect(RARITY_WEIGHT[TRAIT_RARITY.rare] / RARITY_WEIGHT[TRAIT_RARITY.common]).toBe(RARE_TO_COMMON_RATIO);
  });

  it('saturates the tag multiplier at thirty points (P4)', () => {
    expect(1 + TAG_WEIGHT_PER_POINT * SATURATING_TAG_POINTS).toBe(TAG_WEIGHT_MAX_MULTIPLIER);
  });

  it('enters a fresh world at the starting mass and never above the entry cap (PROGRESSION §5)', () => {
    expect(ENTRY_MASS_FRACTION * CELL_STARTING_MASS).toBeLessThan(CELL_STARTING_MASS);
    expect(ENTRY_MAX_MASS).toBeGreaterThan(CELL_STARTING_MASS);
  });
});
