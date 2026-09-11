// docs/ARCHITECTURE.md §3 and docs/DETERMINISM.md §3: the step order by its observable consequences.
import { describe, expect, it } from 'vitest';
import { createTestGameInput, DEFAULT_BALANCE, FOOD_KIND, RANDOM_STREAM, ROUND_PHASE } from '@evolution/shared';
import { BROTH_POINT } from '../../testing/gameplay/placement.js';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import { createInputRejectionCounters, type WorldState } from '../world/world-state.js';
import { forkServerStreams } from '../world/streams.js';
import { resultsDurationTicks, roundDurationTicks } from './round-clock.js';
import { runStep, stepWorld } from './step.js';
import { spawnFoodMote } from './spawn-mote.js';
import { ROUND_STEP_OUTCOME } from './round.js';

function placed(): WorldState {
  const world = createTestWorld();
  world.gelPatches = [];
  const cell = world.cells[0]!;
  cell.x = BROTH_POINT.x;
  cell.y = BROTH_POINT.y;
  cell.targetX = cell.x;
  cell.targetY = cell.y;
  return world;
}

describe('runStep', () => {
  it('increments the tick, applies the input before movement and eats after moving', () => {
    const world = placed();
    const cell = world.cells[0]!;
    world.players[0]!.pendingInput = createTestGameInput({ sequence: 1, targetX: cell.x + 1000, targetY: cell.y });
    // The first tick moves the cell 220 / 15 / 60 ≈ 0.24 wu east: a mote just past the rim is reached after moving.
    spawnFoodMote(world, { kind: FOOD_KIND.algae, variant: null, at: { x: cell.x + cell.radius + 0.1, y: cell.y } });
    runStep(world, world.balance, createInputRejectionCounters());
    expect(world.tick).toBe(1);
    expect(cell.velocityX).toBeGreaterThan(0);
    expect(cell.x).toBeGreaterThan(BROTH_POINT.x);
    expect(world.food).toHaveLength(0);
    expect(cell.mass).toBeGreaterThan(DEFAULT_BALANCE.growth.CELL_STARTING_MASS);
    expect(world.effects).toHaveLength(1);
  });

  it('resets the effects every step and writes the streams back', () => {
    const world = createTestWorld({ isFilled: true });
    const positionBefore = world.random[RANDOM_STREAM.moteMotion].position;
    runStep(world, world.balance, createInputRejectionCounters());
    const effectsFirst = world.effects;
    runStep(world, world.balance, createInputRejectionCounters());
    expect(world.effects).not.toBe(effectsFirst);
    expect(world.random[RANDOM_STREAM.moteMotion].position).toBeGreaterThan(positionBefore);
    expect(world.tick).toBe(2);
    expect(world.leaderboard).toHaveLength(1);
  });

  it('freezes cells and motes during the results phase and still ranks', () => {
    const world = placed();
    const cell = world.cells[0]!;
    cell.targetX = cell.x + 1000;
    world.tick = roundDurationTicks(world) - 1;
    const bacterium = spawnFoodMote(world, { kind: FOOD_KIND.bacterium, variant: 'plain', at: { x: 0, y: 0 } });
    runStep(world, world.balance, createInputRejectionCounters());
    expect(world.roundPhase).toBe(ROUND_PHASE.results);
    const pose = [cell.x, cell.velocityX, bacterium.x, bacterium.y];
    runStep(world, world.balance, createInputRejectionCounters());
    expect([cell.x, cell.velocityX, bacterium.x, bacterium.y]).toEqual(pose);
    expect(world.leaderboard[0]?.playerId).toBe(cell.playerId);
  });

  it('does not overwrite the fresh streams of a rematch', () => {
    const world = placed();
    world.roundPhase = ROUND_PHASE.results;
    world.tick = roundDurationTicks(world) + resultsDurationTicks(world.balance) - 1;
    runStep(world, world.balance, createInputRejectionCounters());
    expect(world.seed).toBe(43);
    expect(world.random[RANDOM_STREAM.traitDraft]).toEqual(forkServerStreams(43)[RANDOM_STREAM.traitDraft]);
    expect(world.random[RANDOM_STREAM.moteMotion].seed).toBe(forkServerStreams(43)[RANDOM_STREAM.moteMotion].seed);
  });

  it('stepWorld reports the round outcome', () => {
    const world = placed();
    expect(stepWorld(world, createTestStepContext(world))).toBe(ROUND_STEP_OUTCOME.playing);
    world.tick = roundDurationTicks(world) - 1;
    expect(stepWorld(world, createTestStepContext(world))).toBe(ROUND_STEP_OUTCOME.results);
  });
});
