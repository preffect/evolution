import { describe, expect, it } from 'vitest';
import { GAME_ERA, ROUND_PHASE, eraStartedAtTick } from '@evolution/shared';
import { createTestWorld, createTestWorldInEras } from '../../testing/world-builders.js';
import { setEraForDebug } from '../debug/debug-era.js';
import type { WorldState } from '../world/world-state.js';
import { MoveBroadcasts } from './move-broadcasts.js';

function poolStartOf(world: WorldState): number {
  return eraStartedAtTick(GAME_ERA.pool, world.roundStartTick, world.balance);
}

describe('MoveBroadcasts.isMoveNext (wire-contract.md §4 "The move": a broadcast closes on the tick before a move)', () => {
  it('is true on the tick before the pool’s start only, while the world has not moved', () => {
    const world = createTestWorldInEras();
    const moves = new MoveBroadcasts(world);
    world.tick = poolStartOf(world) - 2;
    expect(moves.isMoveNext()).toBe(false);
    world.tick += 1;
    expect(moves.isMoveNext()).toBe(true);
    world.tick += 1;
    world.eraMovedInto = GAME_ERA.pool;
    expect(moves.isMoveNext()).toBe(false);
  });

  it('is true after a debug_set_era jump, whose next step runs the move', () => {
    const world = createTestWorldInEras();
    const moves = new MoveBroadcasts(world);
    expect(moves.isMoveNext()).toBe(false);
    setEraForDebug(world, GAME_ERA.colonies);
    expect(moves.isMoveNext()).toBe(true);
  });

  it('is never true with the eras off, nor while the round shows its results', () => {
    const dishOnly = createTestWorld();
    dishOnly.tick = poolStartOf(dishOnly) - 1;
    expect(new MoveBroadcasts(dishOnly).isMoveNext()).toBe(false);
    const world = createTestWorldInEras();
    world.tick = poolStartOf(world) - 1;
    world.roundPhase = ROUND_PHASE.results;
    expect(new MoveBroadcasts(world).isMoveNext()).toBe(false);
  });
});

describe('MoveBroadcasts.isMoveBroadcast (the broadcast that holds the pool’s move goes out as a game_state)', () => {
  it('is true for the one broadcast whose window left the dish', () => {
    const world = createTestWorldInEras();
    const moves = new MoveBroadcasts(world);
    moves.noteBroadcast();
    expect(moves.isMoveBroadcast()).toBe(false);
    world.eraMovedInto = GAME_ERA.pool;
    moves.noteBroadcast();
    expect(moves.isMoveBroadcast()).toBe(true);
    moves.noteBroadcast();
    expect(moves.isMoveBroadcast()).toBe(false);
  });

  it('is true for a window that ran the pool’s and the colonies’ moves, and false for the colonies’ alone', () => {
    const jumped = createTestWorldInEras();
    const jumpMoves = new MoveBroadcasts(jumped);
    jumped.eraMovedInto = GAME_ERA.colonies;
    jumpMoves.noteBroadcast();
    expect(jumpMoves.isMoveBroadcast()).toBe(true);
    const world = createTestWorldInEras();
    world.eraMovedInto = GAME_ERA.pool;
    const moves = new MoveBroadcasts(world);
    world.eraMovedInto = GAME_ERA.colonies;
    moves.noteBroadcast();
    expect(moves.isMoveBroadcast()).toBe(false);
  });

  it('is false for a rematch back into the dish', () => {
    const world = createTestWorldInEras();
    world.eraMovedInto = GAME_ERA.colonies;
    const moves = new MoveBroadcasts(world);
    world.eraMovedInto = GAME_ERA.dish;
    moves.noteBroadcast();
    expect(moves.isMoveBroadcast()).toBe(false);
  });
});
