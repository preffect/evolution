// docs/GAME-DESIGN.md §5.1, §5.4: whole-tick boundaries from the integer counter.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, TICK_HZ, TICK_INTERVAL_MS } from '@evolution/shared';
import { createTestWorld } from '../testing/builders.js';
import {
  bloomStartTick,
  isBloomActive,
  resultsDurationTicks,
  roundDurationTicks,
  roundTimeLeftMs,
} from './round-clock.js';

describe('round clock', () => {
  it('derives whole-tick durations from the config and the balance', () => {
    const world = createTestWorld();
    expect(roundDurationTicks(world)).toBe(world.config.roundDurationSeconds * TICK_HZ);
    expect(resultsDurationTicks(DEFAULT_BALANCE)).toBe(DEFAULT_BALANCE.session.RESULTS_SCREEN_SECONDS * TICK_HZ);
    expect(bloomStartTick(world, DEFAULT_BALANCE)).toBe(
      Math.floor(roundDurationTicks(world) * DEFAULT_BALANCE.session.ROUND_BLOOM_START_FRACTION),
    );
  });

  it('reports the time left from the tick counter, exactly zero at the last tick, never negative', () => {
    const world = createTestWorld();
    expect(roundTimeLeftMs(world)).toBe(world.config.roundDurationSeconds * 1000);
    world.roundElapsedTicks = 1;
    expect(roundTimeLeftMs(world)).toBeCloseTo(world.config.roundDurationSeconds * 1000 - TICK_INTERVAL_MS, 6);
    world.roundElapsedTicks = roundDurationTicks(world);
    expect(roundTimeLeftMs(world)).toBe(0);
    world.roundElapsedTicks = roundDurationTicks(world) + 5;
    expect(roundTimeLeftMs(world)).toBe(0);
  });

  it('flags the bloom from its start tick on', () => {
    const world = createTestWorld();
    world.roundElapsedTicks = bloomStartTick(world, DEFAULT_BALANCE) - 1;
    expect(isBloomActive(world, DEFAULT_BALANCE)).toBe(false);
    world.roundElapsedTicks += 1;
    expect(isBloomActive(world, DEFAULT_BALANCE)).toBe(true);
  });
});
