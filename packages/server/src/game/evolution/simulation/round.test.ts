// docs/GAME-DESIGN.md §5.4 (G2) and docs/DETERMINISM.md §3, §7: the round boundaries and the rematch.
import { describe, expect, it } from 'vitest';
import { CELL_STAGE, DEFAULT_BALANCE, playerId, ROUND_PHASE } from '@evolution/shared';
import { createTestStepContext, createTestWorld } from '../testing/builders.js';
import { forkServerStreams } from '../world/streams.js';
import type { WorldState } from '../world/world-state.js';
import { resultsDurationTicks, roundDurationTicks } from './round-clock.js';
import { advanceRound, resetWorldForRematch, ROUND_STEP_OUTCOME } from './round.js';

function advanceTo(world: WorldState, elapsedTicks: number): void {
  world.roundElapsedTicks = elapsedTicks;
}

describe('advanceRound', () => {
  it('stays playing until the tick the timer reaches zero, then flips to results on that tick', () => {
    const world = createTestWorld();
    const context = createTestStepContext(world);
    const duration = roundDurationTicks(world);
    advanceTo(world, duration - 2);
    expect(advanceRound(world, context)).toBe(ROUND_STEP_OUTCOME.playing);
    expect(world.roundPhase).toBe(ROUND_PHASE.playing);
    expect(world.roundTimeLeftMs).toBeGreaterThan(0);
    expect(advanceRound(world, context)).toBe(ROUND_STEP_OUTCOME.results);
    expect(world.roundPhase).toBe(ROUND_PHASE.results);
    expect(world.roundElapsedTicks).toBe(duration);
    expect(world.roundTimeLeftMs).toBe(0);
    expect(world.resultsElapsedTicks).toBe(0);
  });

  it('rematches on the tick the results elapsed count reaches its length, with seed + 1', () => {
    const world = createTestWorld({ players: [{ playerId: playerId('p1'), playerName: 'A', avatarIndex: 0 }] });
    const context = createTestStepContext(world);
    const player = world.players[0]!;
    player.level = 4;
    player.ownedTraits.push({ traitId: 'nucleoid', tier: 1 });
    world.tick = 36_000;
    world.roundPhase = ROUND_PHASE.results;
    const results = resultsDurationTicks(DEFAULT_BALANCE);
    for (let tick = 1; tick < results; tick += 1) {
      world.tick += 1;
      expect(advanceRound(world, context)).toBe(ROUND_STEP_OUTCOME.results);
    }
    const idsBefore = world.nextEntityNumber;
    world.tick += 1;
    expect(advanceRound(world, context)).toBe(ROUND_STEP_OUTCOME.rematched);
    expect(world.roundPhase).toBe(ROUND_PHASE.playing);
    expect(world.seed).toBe(42 + DEFAULT_BALANCE.session.ROUND_SEED_INCREMENT);
    expect(world.tick).toBe(36_000 + results);
    expect(world.roundElapsedTicks).toBe(0);
    expect(world.players.map((entry) => entry.playerId)).toEqual(['p1']);
    expect(world.players[0]!.level).toBe(1);
    expect(world.players[0]!.ownedTraits).toEqual([]);
    expect(world.cells[0]!.stage).toBe(CELL_STAGE.protocell);
    expect(world.cells[0]!.mass).toBe(DEFAULT_BALANCE.growth.CELL_STARTING_MASS);
    expect(world.nextEntityNumber).toBeGreaterThan(idsBefore);
  });
});

describe('resetWorldForRematch', () => {
  it('rebuilds the world in place with fresh streams from the new seed and the same roster', () => {
    const world = createTestWorld({
      players: [
        { playerId: playerId('p1'), playerName: 'A', avatarIndex: 0 },
        { playerId: playerId('p2'), playerName: 'B', avatarIndex: 3 },
      ],
    });
    const reference = world;
    resetWorldForRematch(world, createTestStepContext(world));
    expect(world).toBe(reference);
    expect(world.seed).toBe(43);
    expect(world.players.map((entry) => [entry.playerId, entry.avatarIndex, entry.joinOrder])).toEqual([
      ['p1', 0, 0],
      ['p2', 3, 1],
    ]);
    const fresh = forkServerStreams(43);
    // The spawner, placement and zones streams were drawn from by createWorld; the untouched ones are pristine.
    expect(world.random.trait_draft).toEqual(fresh.trait_draft);
    expect(world.random.spawner.seed).toBe(fresh.spawner.seed);
    expect(world.food.length).toBeGreaterThan(0);
  });
});
