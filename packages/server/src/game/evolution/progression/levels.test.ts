// docs/PROGRESSION.md §2 (thresholds, carry-over) and step 7 of the tick.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, EFFECT_KIND, levelUpCost } from '@evolution/shared';
import { createTestStepContext, createTestWorld } from '../testing/builders.js';
import { gainDna } from './dna.js';
import {
  applyLevelUps,
  cumulativeDnaForLevel,
  levelForCumulativeDna,
  runProgression,
  setLevelFromCumulativeDna,
} from './levels.js';
import { shownOffer } from './offers.js';

const balance = DEFAULT_BALANCE;
const { MAX_LEVEL } = balance.progression;
const cost = (level: number): number => levelUpCost(level, balance.progression);

describe('level thresholds', () => {
  it('sums the costs below a level (the doc table, derived from levelUpCost)', () => {
    expect(cumulativeDnaForLevel(1, balance)).toBe(0);
    expect(cumulativeDnaForLevel(2, balance)).toBe(cost(1));
    expect(cumulativeDnaForLevel(3, balance)).toBe(cost(1) + cost(2));
    let total = 0;
    for (let level = 1; level < MAX_LEVEL; level += 1) total += cost(level);
    expect(cumulativeDnaForLevel(MAX_LEVEL, balance)).toBe(total);
  });

  it('finds the level a cumulative DNA covers, capped at MAX_LEVEL', () => {
    expect(levelForCumulativeDna(0, balance)).toBe(1);
    expect(levelForCumulativeDna(cost(1) - 1, balance)).toBe(1);
    expect(levelForCumulativeDna(cost(1), balance)).toBe(2);
    expect(levelForCumulativeDna(cost(1) + cost(2), balance)).toBe(3);
    expect(levelForCumulativeDna(cumulativeDnaForLevel(MAX_LEVEL, balance) * 10, balance)).toBe(MAX_LEVEL);
  });

  it('sets the level silently from cumulative DNA, syncing the cell', () => {
    const world = createTestWorld();
    const player = world.players[0]!;
    player.dnaCumulative = cost(1) + cost(2) + 5;
    setLevelFromCumulativeDna(world, player);
    expect(player.level).toBe(3);
    expect(player.dnaTowardNextLevel).toBe(5);
    expect(player.offerQueue).toHaveLength(0);
    expect(world.cells[0]!.level).toBe(3);
  });
});

describe('applyLevelUps', () => {
  it('carries the remainder over and queues one offer per level', () => {
    const world = createTestWorld();
    const context = createTestStepContext(world);
    const player = world.players[0]!;
    gainDna(player, cost(1) + cost(2) + 10, 1);
    expect(applyLevelUps(world, player, context)).toBe(2);
    expect(player.level).toBe(3);
    expect(player.dnaTowardNextLevel).toBe(10);
    expect(player.offerQueue.map((offer) => offer.offerId)).toEqual([1, 2]);
    expect(world.cells[0]!.level).toBe(3);
    expect(
      context.effects.filter((effect) => effect.kind === EFFECT_KIND.levelUp).map((effect) => effect.tick),
    ).toEqual([world.tick, world.tick]);
  });

  it('does nothing below the threshold and stops at MAX_LEVEL', () => {
    const world = createTestWorld();
    const context = createTestStepContext(world);
    const player = world.players[0]!;
    gainDna(player, cost(1) - 1, 1);
    expect(applyLevelUps(world, player, context)).toBe(0);
    player.level = MAX_LEVEL;
    gainDna(player, cost(MAX_LEVEL) * 3, 1);
    expect(applyLevelUps(world, player, context)).toBe(0);
    expect(player.level).toBe(MAX_LEVEL);
  });

  it('emits no effect for a player without a cell', () => {
    const world = createTestWorld();
    const context = createTestStepContext(world);
    world.cells = [];
    const player = world.players[0]!;
    gainDna(player, cost(1), 1);
    expect(applyLevelUps(world, player, context)).toBe(1);
    expect(context.effects).toHaveLength(0);
  });
});

describe('runProgression (step 7)', () => {
  it('shows the offer on the tick of the level-up, and auto-picks on the tick it expires', () => {
    const world = createTestWorld();
    const context = createTestStepContext(world);
    const player = world.players[0]!;
    world.tick = 12;
    gainDna(player, cost(1), 1);
    runProgression(world, context);
    const offer = shownOffer(player);
    expect(offer?.offerId).toBe(1);
    expect(offer?.shownAtTick).toBe(12);
    expect(offer?.expiresAtTick).toBe(12 + 600);
    world.tick = 12 + 599;
    runProgression(world, context);
    expect(shownOffer(player)?.offerId).toBe(1);
    world.tick = 12 + 600;
    runProgression(world, context);
    expect(shownOffer(player)).toBeUndefined();
    expect(player.ownedTraits).toEqual([{ traitId: 'nucleoid', tier: 1 }]);
  });

  it('does not show a queued offer without a level-up this tick', () => {
    const world = createTestWorld();
    const context = createTestStepContext(world);
    const player = world.players[0]!;
    gainDna(player, cost(1) + cost(2), 1);
    runProgression(world, context);
    expect(shownOffer(player)?.offerId).toBe(1);
    player.offerQueue.shift();
    player.offer = null;
    runProgression(world, context);
    expect(shownOffer(player)).toBeUndefined();
    expect(player.offerQueue[0]?.offerId).toBe(2);
  });
});
