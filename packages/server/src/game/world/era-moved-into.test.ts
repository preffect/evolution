// docs/architecture/server-simulation.md §3 and docs/architecture/entity-model.md §2: `eraMovedInto`, the record of which
// moves have run. The dish when the world is built (creation, rematch), kept by a reseed, left alone by a jump (the next
// step runs the moves, ticket #868); the snapshot's `era` copies it, never the clock's `eraAt`.
import { describe, expect, it } from 'vitest';
import { GAME_ERA, GAME_ERA_ORDER, createTestSessionConfig, withErasInPlay } from '@evolution/shared';
import { TEST_PLAYER, createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import { setEraForDebug } from '../debug/debug-era.js';
import { reseedForDebug } from '../debug/debug-operations.js';
import { serializeBroadcastSnapshot, serializeFullSnapshot } from '../serialize/serialize.js';
import { roundEraAt } from '../simulation/round-clock.js';
import { resetWorldForRematch } from '../simulation/round.js';
import type { WorldState } from './world-state.js';

/** The game's length with the colonies on (phases.md §14.2.3), so every era is reachable. */
const COLONIES_ON_ROUND_SECONDS = 1500;
/** The pool's first tick after a round start at 0 (phases.md §14.2.1). */
const POOL_FIRST_TICK = 36_000;
const RESEED = 9;

/** A world with every era in play, the round long enough to reach them all. */
function worldWithEveryEra(): WorldState {
  const world = createTestWorld({ players: [TEST_PLAYER], balance: withErasInPlay(GAME_ERA_ORDER) });
  world.config = createTestSessionConfig({ seed: world.seed, roundDurationSeconds: COLONIES_ON_ROUND_SECONDS });
  return world;
}

describe('eraMovedInto', () => {
  it('is the dish when the world is built', () => {
    expect(createTestWorld().eraMovedInto).toBe(GAME_ERA.dish);
  });

  it('goes back to the dish at a rematch, which rebuilds the world', () => {
    const world = worldWithEveryEra();
    world.eraMovedInto = GAME_ERA.colonies;
    resetWorldForRematch(world, createTestStepContext(world));
    expect(world.eraMovedInto).toBe(GAME_ERA.dish);
  });

  it('is kept by a reseed, which rebuilds only the streams of a world that keeps running', () => {
    const world = worldWithEveryEra();
    world.eraMovedInto = GAME_ERA.pool;
    reseedForDebug(world, RESEED);
    expect(world.eraMovedInto).toBe(GAME_ERA.pool);
  });

  it('is left alone by a debug_set_era jump: the clock moves on, the next step runs the moves', () => {
    const world = worldWithEveryEra();
    setEraForDebug(world, GAME_ERA.colonies);
    expect(world.eraMovedInto).toBe(GAME_ERA.dish);
  });
});

describe('the snapshot’s era', () => {
  it.each(GAME_ERA_ORDER)('copies the era moved into (%s), in the full state and the broadcast alike', (era) => {
    const world = worldWithEveryEra();
    world.eraMovedInto = era;
    expect(serializeFullSnapshot(world).era).toBe(era);
    expect(serializeBroadcastSnapshot(world).era).toBe(era);
  });

  it('is the era moved into, not the clock’s: the dish until the step runs the move', () => {
    const world = worldWithEveryEra();
    world.tick = POOL_FIRST_TICK;
    expect(roundEraAt(world, world.tick)).toBe(GAME_ERA.pool);
    expect(serializeFullSnapshot(world).era).toBe(GAME_ERA.dish);
  });
});
