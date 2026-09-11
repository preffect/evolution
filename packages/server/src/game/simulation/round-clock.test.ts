// docs/GAME-DESIGN.md §5.1, §5.4: whole-tick boundaries from the integer counter.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, TICK_HZ, TICK_INTERVAL_MS } from '@evolution/shared';
import { createTestWorld } from '../../testing/world-builders.js';
import {
  bloomStartTick,
  isBloomActive,
  resultsDurationTicks,
  resultsElapsedTicksAt,
  roundDurationTicks,
  roundElapsedTicksAt,
  roundTimeLeftMsAt,
  worldReferenceAt,
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
    expect(roundTimeLeftMsAt(world, 0)).toBe(world.config.roundDurationSeconds * 1000);
    expect(roundTimeLeftMsAt(world, 1)).toBeCloseTo(world.config.roundDurationSeconds * 1000 - TICK_INTERVAL_MS, 6);
    expect(roundTimeLeftMsAt(world, roundDurationTicks(world))).toBe(0);
    expect(roundTimeLeftMsAt(world, roundDurationTicks(world) + 5)).toBe(0);
  });

  it('counts the round and the results from roundStartTick, so a rematch starts the clock again', () => {
    const world = createTestWorld();
    world.roundStartTick = 37_200;
    expect(roundElapsedTicksAt(world, 37_201)).toBe(1);
    expect(resultsElapsedTicksAt(world, 37_200 + roundDurationTicks(world) + 3)).toBe(3);
    expect(resultsElapsedTicksAt(world, 37_201)).toBeLessThan(0);
  });

  it('flags the bloom from its start tick on', () => {
    const world = createTestWorld();
    world.tick = bloomStartTick(world, DEFAULT_BALANCE) - 1;
    expect(isBloomActive(world, DEFAULT_BALANCE)).toBe(false);
    world.tick += 1;
    expect(isBloomActive(world, DEFAULT_BALANCE)).toBe(true);
  });

  it('reads the world reference of the tick in progress and freezes it through results (G11)', () => {
    const world = createTestWorld();
    expect(worldReferenceAt(world, 10_799).worldLevel).toBeLessThan(2);
    expect(worldReferenceAt(world, 10_800)).toMatchObject({ worldLevel: 2, worldStage: 'prokaryote', worldMass: 200 });
    const atRoundEnd = worldReferenceAt(world, roundDurationTicks(world));
    expect(worldReferenceAt(world, roundDurationTicks(world) + 600)).toEqual(atRoundEnd);
    world.roundStartTick = 37_200;
    expect(worldReferenceAt(world, 37_200).worldLevel).toBe(1);
  });
});
