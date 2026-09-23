import { describe, expect, it } from 'vitest';
import { DEFAULT_CELL_MODIFIERS } from '../constants/trait-modifiers.js';
import { isReachedByToxin, toxinReachDistance } from './toxin-reach.js';

const RADIUS = 10;
const AURA_RADII = 1.5;
const plain = { x: 0, y: 0, radius: RADIUS, modifiers: DEFAULT_CELL_MODIFIERS };
const aura = { ...plain, modifiers: { ...DEFAULT_CELL_MODIFIERS, toxinAuraRangeInRadii: AURA_RADII } };

describe('toxinReachDistance', () => {
  it('is the contact distance without an aura, and reaches the aura’s radii past the rim with one', () => {
    expect(toxinReachDistance(RADIUS, plain)).toBe(RADIUS + RADIUS);
    expect(toxinReachDistance(RADIUS, aura)).toBe(RADIUS + RADIUS * (1 + AURA_RADII));
  });
});

describe('isReachedByToxin', () => {
  it('reaches at contact and not a step past it', () => {
    expect(isReachedByToxin({ x: 2 * RADIUS, y: 0, radius: RADIUS }, plain)).toBe(true);
    expect(isReachedByToxin({ x: 2 * RADIUS + 1, y: 0, radius: RADIUS }, plain)).toBe(false);
  });

  it('reaches through the aura without contact', () => {
    expect(isReachedByToxin({ x: 2 * RADIUS + 1, y: 0, radius: RADIUS }, aura)).toBe(true);
  });
});
