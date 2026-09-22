// docs/testing/scenario-runner.md §8: the Evolution adapter's scenario duties on a real module.
import { describe, expect, it } from 'vitest';
import { CELL_KIND, EFFECT_KIND, createTestSessionConfig, gameId, playerId, type CellView } from '@evolution/shared';
import { worldReferenceAt } from '../../game/simulation/round-clock.js';
import { computeStateHash } from '../../game/world/state-hash.js';
import type { FixtureContext } from './adapter.js';
import {
  PLACED_ROW_SEED,
  applyEvolutionFixture,
  clearFood,
  evolutionAdapter,
  resetSpawnerAccumulators,
  createLazyScenarioSnapshot,
  type EvolutionScenarioModule,
} from './evolution-adapter.js';
import { ScenarioSetupError } from './errors.js';
import { placeCell, placeMote, placeWildCell } from './fixtures.js';
import { ZONE } from './placement.js';

const alice = playerId('player_0');
const context: FixtureContext = { tick: 0, playerId: () => alice };

function moduleUnderTest(): EvolutionScenarioModule {
  return evolutionAdapter.createModule({
    gameId: gameId('adapter-game'),
    creatorId: alice,
    playerIds: [alice],
    gameName: 'adapter',
    config: createTestSessionConfig({ seed: PLACED_ROW_SEED }),
    avatarAssignments: { [alice]: 0 },
    playerNames: { [alice]: 'Alice' },
  }) as EvolutionScenarioModule;
}

function playerCells(cells: readonly CellView[]): readonly CellView[] {
  return cells.filter((cell) => cell.kind === CELL_KIND.player);
}

describe('evolutionAdapter', () => {
  it('builds the module from the config seed and reads the scenario snapshot with exact positions and effects', () => {
    const module = moduleUnderTest();
    expect(module.world.seed).toBe(PLACED_ROW_SEED);
    module.reduceGameState();
    const snapshot = evolutionAdapter.readSnapshot(module);
    expect(snapshot.tick).toBe(1);
    expect(snapshot.cells[0]?.x).toBe(module.world.cells[0]?.x);
    expect(snapshot.spawnedCounts.food).toBe(module.world.spawners.food.spawnedCount);
    expect(snapshot.effects).toEqual(module.world.effects);
    expect(snapshot.effects).not.toBe(module.world.effects);
    expect(module.serializeRoomState()).toEqual(createLazyScenarioSnapshot(module.world).snapshot);
    expect(module.serializeFullState().snapshot).toEqual(createLazyScenarioSnapshot(module.world).snapshot);
  });

  it('pins the last snapshot before a fixture, a join or a leave changes the world between ticks', () => {
    const module = moduleUnderTest();
    module.reduceGameState();
    const snapshot = evolutionAdapter.readSnapshot(module);
    const massBefore = module.world.cells[0]!.mass;
    evolutionAdapter.applyFixture(module, placeCell({ playerIndex: 0, mass: massBefore + 50 }, undefined), context);
    expect(snapshot.cells[0]?.mass).toBe(massBefore);
    const next = evolutionAdapter.readSnapshot(module);
    expect(next.cells[0]?.mass).toBe(massBefore + 50);
    // The world also seats its wild cells (ticket #496); the pin is about the players' cells.
    module.addPlayer(playerId('bob'), 1, 'Bob');
    expect(playerCells(next.cells)).toHaveLength(1);
    module.removePlayer(playerId('bob'));
    expect(playerCells(evolutionAdapter.readSnapshot(module).cells)).toHaveLength(1);
  });

  it('drains the effects into the snapshot it hands the runner, as the broadcast would', () => {
    const module = moduleUnderTest();
    module.world.tick = 18_000;
    module.addPlayer(playerId('bob'), 1, 'Bob');
    module.reduceGameState();
    const snapshot = evolutionAdapter.readSnapshot(module);
    expect(snapshot.effects.some((effect) => effect.kind === EFFECT_KIND.levelUp)).toBe(true);
    expect(evolutionAdapter.readSnapshot(module).effects).toEqual([]);
  });

  it("reads the wild seats with their cells' latched targets, pinned like the rest of the snapshot", () => {
    const module = moduleUnderTest();
    module.reduceGameState();
    const snapshot = evolutionAdapter.readSnapshot(module);
    const seat = module.world.wildSeats[0]!;
    const seated = { ...seat };
    expect(snapshot.wildSeats).toHaveLength(module.world.wildSeats.length);
    expect(snapshot.wildSeats[0]).toEqual({ ...seated, targetX: null, targetY: null });
    expect(snapshot.wildSeats[0]).not.toBe(seat);
    const fixture = placeWildCell({ seat: 0, spreadFactor: 5, at: ZONE.broth }, undefined);
    evolutionAdapter.applyFixture(module, fixture, context);
    // The seat record moved on; the pinned snapshot still reads the seat as it was.
    expect(seat.massSpreadFactor).toBe(5);
    expect(snapshot.wildSeats[0]).toEqual({ ...seated, targetX: null, targetY: null });
    const next = evolutionAdapter.readSnapshot(module);
    expect(next.wildSeats[0]).toMatchObject({ massSpreadFactor: 5, cellId: seat.cellId });
    expect(next.wildSeats[0]?.cellId).not.toBe(seated.cellId);
    expect(next.cells.find((cell) => cell.id === seat.cellId)?.mass).toBe(
      5 * worldReferenceAt(module.world, module.world.tick).worldMass,
    );
  });

  it('hashes the world through computeStateHash and locates a cell through the binding', () => {
    const module = moduleUnderTest();
    expect(evolutionAdapter.hashState(module)).toBe(computeStateHash(module.world));
    const snapshot = evolutionAdapter.readSnapshot(module);
    const cell = module.world.cells[0]!;
    expect(evolutionAdapter.locateCell(snapshot, alice)).toEqual({ x: cell.x, y: cell.y, radius: cell.radius });
    expect(evolutionAdapter.locateCell(snapshot, playerId('nobody'))).toBeUndefined();
  });

  it('switches the seeded spawns off on the first placed record and applies the world fixtures', () => {
    const module = moduleUnderTest();
    const { world } = module;
    world.spawners.food.accumulator = 0.5;
    applyEvolutionFixture(world, resetSpawnerAccumulators, context);
    expect(world.spawners.food.accumulator).toBe(0);
    expect(world.spawners.food.isEnabled).toBe(true);
    applyEvolutionFixture(world, clearFood, context);
    expect(world.food).toEqual([]);
    evolutionAdapter.applyFixture(module, placeMote({ moteKind: 'algae', at: ZONE.vent }, undefined), context);
    expect(world.spawners.food.isEnabled).toBe(false);
    expect(world.food).toHaveLength(1);
  });

  it('refuses a placed record on a seed whose gel patch reaches the broth point', () => {
    const module = evolutionAdapter.createModule({
      gameId: gameId('blocked-game'),
      creatorId: alice,
      playerIds: [alice],
      gameName: 'blocked',
      config: createTestSessionConfig({ seed: 42 }),
      avatarAssignments: {},
      playerNames: {},
    });
    expect(() =>
      evolutionAdapter.applyFixture(module, placeMote({ moteKind: 'algae', at: ZONE.vent }, undefined), context),
    ).toThrow(ScenarioSetupError);
  });
});
