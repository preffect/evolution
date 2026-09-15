import { describe, expect, it } from 'vitest';
import { createTestGameInput } from '../testing/builders.js';
import { hasSteerTarget } from './input-guards.js';

describe('hasSteerTarget', () => {
  it('is true only when both coordinates are set', () => {
    expect(hasSteerTarget(createTestGameInput({ targetX: 0, targetY: 0 }))).toBe(true);
    expect(hasSteerTarget(createTestGameInput({ targetX: null, targetY: null }))).toBe(false);
    expect(hasSteerTarget(createTestGameInput({ targetX: 5, targetY: null }))).toBe(false);
    expect(hasSteerTarget(createTestGameInput({ targetX: null, targetY: 5 }))).toBe(false);
  });
});
