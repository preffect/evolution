import { describe, expect, it } from 'vitest';
import { entityId, secondsToTicks, type GameEffect } from '@evolution/shared';
import { createTestCellAbsorbedEffect, createTestEatEffect } from '../../../testing/builders';
import { AFFECTING_FOOD_WINDOW_SECONDS } from '../hud/hud-constants';
import { eatenMassOf, foodGainPerSecondFor, recentEatsFor, type RecentEatsMemory } from './recent-eats';

const CELL = entityId('c-1');
const OTHER_CELL = entityId('c-2');
const WINDOW_TICKS = secondsToTicks(AFFECTING_FOOD_WINDOW_SECONDS);

function ate(mass: number): GameEffect {
  return createTestEatEffect({ cellId: CELL, massGained: mass });
}

/** The rate a single gain of `mass` inside the window reads as: the gain spread over the whole window. */
function rateOf(mass: number): number {
  return mass / AFFECTING_FOOD_WINDOW_SECONDS;
}

describe('eatenMassOf', () => {
  it('sums the own cell eats of one snapshot, using the server amount rather than a formula', () => {
    expect(eatenMassOf({ cellId: CELL, tick: 0, effects: [ate(1), ate(2.5)] })).toBe(3.5);
  });

  it('ignores another cell eats, which are not our food', () => {
    const theirs = createTestEatEffect({ cellId: OTHER_CELL, massGained: 9 });
    expect(eatenMassOf({ cellId: CELL, tick: 0, effects: [theirs] })).toBe(0);
  });

  it('ignores an engulf payout: swallowing a cell is not grazing, and the row names food', () => {
    const engulf = createTestCellAbsorbedEffect({ predatorCellId: CELL, predatorMassGained: 60 });
    expect(eatenMassOf({ cellId: CELL, tick: 0, effects: [engulf] })).toBe(0);
  });
});

describe('foodGainPerSecondFor', () => {
  it('reads a gain as a rate over the whole window, so one mote is a slow rate and not a spike', () => {
    const memory = recentEatsFor(null, { cellId: CELL, tick: 0, effects: [ate(5.5)] });
    expect(foodGainPerSecondFor(memory, CELL)).toBeCloseTo(rateOf(5.5));
  });

  it('adds up the gains still inside the window', () => {
    let memory = recentEatsFor(null, { cellId: CELL, tick: 0, effects: [ate(2)] });
    memory = recentEatsFor(memory, { cellId: CELL, tick: 1, effects: [ate(3)] });
    expect(foodGainPerSecondFor(memory, CELL)).toBeCloseTo(rateOf(5));
  });

  it('drops a gain once it falls out of the window, so a rate decays to nothing', () => {
    let memory: RecentEatsMemory | null = recentEatsFor(null, { cellId: CELL, tick: 0, effects: [ate(5)] });
    memory = recentEatsFor(memory, { cellId: CELL, tick: WINDOW_TICKS + 1, effects: [] });
    expect(foodGainPerSecondFor(memory, CELL)).toBe(0);
  });

  it('counts a snapshot once, so a recomputation never doubles a rate', () => {
    const first = recentEatsFor(null, { cellId: CELL, tick: 7, effects: [ate(4)] });
    const again = recentEatsFor(first, { cellId: CELL, tick: 7, effects: [ate(4)] });
    expect(foodGainPerSecondFor(again, CELL)).toBeCloseTo(rateOf(4));
  });

  it('starts over on a new own cell, so a respawn does not inherit the last life feeding', () => {
    const fed = recentEatsFor(null, { cellId: CELL, tick: 0, effects: [ate(5)] });
    const respawned = recentEatsFor(fed, { cellId: OTHER_CELL, tick: 1, effects: [] });
    expect(foodGainPerSecondFor(respawned, OTHER_CELL)).toBe(0);
  });

  it('answers zero for another cell memory or none, which omits the row rather than showing +0/s', () => {
    expect(foodGainPerSecondFor(null, CELL)).toBe(0);
    const memory = recentEatsFor(null, { cellId: CELL, tick: 0, effects: [ate(5)] });
    expect(foodGainPerSecondFor(memory, OTHER_CELL)).toBe(0);
  });
});
