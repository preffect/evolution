import { describe, expect, it } from 'vitest';
import { createTestPlayerRecord } from '../testing/builders.js';
import { gainDna, gainTagPoints, grantCatchUpGift } from './dna.js';

describe('dna gains', () => {
  it('multiplies a gain and moves both counters', () => {
    const player = createTestPlayerRecord();
    gainDna(player, 10, 1.05);
    expect(player.dnaCumulative).toBeCloseTo(10.5, 12);
    expect(player.dnaTowardNextLevel).toBeCloseTo(10.5, 12);
    expect(player.dnaCatchUpGift).toBe(0);
  });

  it('adds tag points by tag', () => {
    const player = createTestPlayerRecord();
    gainTagPoints(player, 'motile', 2);
    gainTagPoints(player, 'motile', 1);
    expect(player.dnaTagPoints.motile).toBe(3);
    expect(player.dnaTagPoints.photic).toBe(0);
  });

  it('records the catch-up gift without a multiplier', () => {
    const player = createTestPlayerRecord();
    grantCatchUpGift(player, 60);
    expect(player.dnaCumulative).toBe(60);
    expect(player.dnaCatchUpGift).toBe(60);
    expect(player.dnaTowardNextLevel).toBe(60);
  });
});
