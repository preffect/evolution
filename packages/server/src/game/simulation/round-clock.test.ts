// docs/game-design/session.md §5.1, §5.4: whole-tick boundaries from the integer counter.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  GAME_ERA,
  TICK_HZ,
  TICK_INTERVAL_MS,
  createTestSessionConfig,
  withErasInPlay,
} from '@evolution/shared';
import { COLONIES_ON_ROUND_SECONDS, createTestWorld, createTestWorldInEras } from '../../testing/world-builders.js';
import {
  bloomStartTick,
  dishEraEndTicks,
  isBloomActive,
  resultsDurationTicks,
  resultsElapsedTicksAt,
  roundDurationTicks,
  roundElapsedTicksAt,
  roundEraAt,
  roundTimeLeftMsAt,
  worldReferenceAt,
} from './round-clock.js';

/** The pool's first tick after a round start at 0, in a round long enough to reach it (phases.md §14.2.1). */
const POOL_FIRST_TICK = 36_000;
const POOL_ON_ROUND_SECONDS = 1020;
/** With the pool in play the bloom runs 8:00–10:00 (phases.md §14.2.1): 0.8 of the dish era's 36 000 ticks. */
const DISH_ERA_BLOOM_START_TICK = 28_800;
/** §14.2.2: the pool's world mass at 10:00 and at 17:00. */
const POOL_WORLD_MASS_AT_THE_MOVE = 60;
const POOL_WORLD_MASS_AT_THE_COLONIES = 270;
const COLONIES_FIRST_TICK = 61_200;

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

  it('keeps the bloom in the dish era: 8:00 to 10:00 with the pool in play, none in the pool', () => {
    const world = createTestWorldInEras(undefined, COLONIES_ON_ROUND_SECONDS);
    expect(dishEraEndTicks(world, world.balance)).toBe(POOL_FIRST_TICK);
    expect(bloomStartTick(world, world.balance)).toBe(DISH_ERA_BLOOM_START_TICK);
    for (const [tick, isActive] of [
      [DISH_ERA_BLOOM_START_TICK - 1, false],
      [DISH_ERA_BLOOM_START_TICK, true],
      [POOL_FIRST_TICK - 1, true],
      [POOL_FIRST_TICK, false],
      [COLONIES_FIRST_TICK, false],
    ] as const) {
      world.tick = tick;
      expect(isBloomActive(world, world.balance), `tick ${tick}`).toBe(isActive);
    }
  });

  it('runs the bloom to the round’s end with the eras off, as today, in a round as long as the colonies’', () => {
    const world = createTestWorld();
    world.config = createTestSessionConfig({ seed: world.seed, roundDurationSeconds: COLONIES_ON_ROUND_SECONDS });
    world.tick = roundDurationTicks(world) - 1;
    expect(isBloomActive(world, DEFAULT_BALANCE)).toBe(true);
    expect(bloomStartTick(world, DEFAULT_BALANCE)).toBe(
      Math.floor(roundDurationTicks(world) * DEFAULT_BALANCE.session.ROUND_BLOOM_START_FRACTION),
    );
  });

  it('restarts the world mass at the pool’s move and runs it on into the colonies (phases.md §14.2.2)', () => {
    const world = createTestWorldInEras(undefined, COLONIES_ON_ROUND_SECONDS);
    expect(worldReferenceAt(world, POOL_FIRST_TICK - 1).worldMass).toBeGreaterThan(POOL_WORLD_MASS_AT_THE_COLONIES);
    expect(worldReferenceAt(world, POOL_FIRST_TICK).worldMass).toBe(POOL_WORLD_MASS_AT_THE_MOVE);
    expect(worldReferenceAt(world, COLONIES_FIRST_TICK).worldMass).toBe(POOL_WORLD_MASS_AT_THE_COLONIES);
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

  it('reads the era of a tick from roundStartTick, on the world’s balance or a patched one (phases.md §14.2.1)', () => {
    const world = createTestWorld();
    world.config = createTestSessionConfig({ seed: world.seed, roundDurationSeconds: POOL_ON_ROUND_SECONDS });
    const poolOn = withErasInPlay([GAME_ERA.dish, GAME_ERA.pool]);
    expect(roundEraAt(world, POOL_FIRST_TICK)).toBe(GAME_ERA.dish);
    expect(roundEraAt(world, POOL_FIRST_TICK - 1, poolOn)).toBe(GAME_ERA.dish);
    expect(roundEraAt(world, POOL_FIRST_TICK, poolOn)).toBe(GAME_ERA.pool);
    world.roundStartTick = -POOL_FIRST_TICK;
    expect(roundEraAt(world, 0, poolOn)).toBe(GAME_ERA.pool);
  });
});
