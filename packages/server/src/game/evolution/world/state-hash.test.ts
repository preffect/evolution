// docs/DETERMINISM.md §5, §7: equal worlds hash equal, any hashed field change moves the hash, NaN
// throws, and every non-derived record field is listed.
import { describe, expect, it } from 'vitest';
import { FOOD_KIND, StateHashError, createTestGameInput } from '@evolution/shared';
import { spawnDnaFragment, spawnFoodMote } from '../simulation/spawn-mote.js';
import { createTestWorld } from '../testing/builders.js';
import type { WorldState } from './world-state.js';
import {
  CELL_HASHED_FIELDS,
  DERIVED_FIELDS,
  DNA_FRAGMENT_HASHED_FIELDS,
  FOOD_MOTE_HASHED_FIELDS,
  GEL_PATCH_HASHED_FIELDS,
  PLAYER_HASHED_FIELDS,
  SPAWNER_HASHED_FIELDS,
  WORLD_SCALAR_HASHED_FIELDS,
  computeStateHash,
} from './state-hash.js';

function keysOf(fields: readonly unknown[]): string[] {
  return fields.map((field) => (typeof field === 'string' ? field : (field as { key: string }).key)).sort();
}

function populatedWorld(): WorldState {
  const world = createTestWorld();
  spawnFoodMote(world, { kind: FOOD_KIND.bacterium, variant: 'aerobic', at: { x: 100, y: 0 } });
  spawnDnaFragment(world, { at: { x: 0, y: 100 }, tag: 'photic', driftTurn: 0.25 });
  return world;
}

describe('computeStateHash', () => {
  it('hashes two worlds built the same way equal, and 16 hex characters long', () => {
    const hash = computeStateHash(populatedWorld());
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
    expect(computeStateHash(populatedWorld())).toBe(hash);
  });

  it.each<[string, (world: WorldState) => void]>([
    ['tick', (world) => (world.tick += 1)],
    ['seed', (world) => (world.seed += 1)],
    ['roundElapsedTicks', (world) => (world.roundElapsedTicks += 1)],
    ['a cell position', (world) => (world.cells[0]!.x += 1)],
    ['a cell trait', (world) => world.cells[0]!.traits.push({ traitId: 'cilia', tier: 1 })],
    ['a mote heading', (world) => (world.food[0]!.headingRadians += 1)],
    ['a fragment drift', (world) => (world.dnaFragments[0]!.driftX += 1)],
    ['a tag point', (world) => (world.players[0]!.dnaTagPoints.toxic += 1)],
    ['a variant counter', (world) => (world.players[0]!.bacteriaEatenByVariant.aerobic += 1)],
    ['a pending input', (world) => (world.players[0]!.pendingInput = createTestGameInput())],
    [
      'a reserved input flag',
      (world) => (world.players[0]!.pendingInput = createTestGameInput({ shouldSplit: false })),
    ],
    [
      'a queued offer',
      (world) =>
        world.players[0]!.offerQueue.push({
          offerId: 1,
          cards: [],
          expiresAtTick: 0,
          shownAtTick: null,
          cardWeights: [],
          catalogIndexes: [],
        }),
    ],
    ['a gel patch', (world) => (world.gelPatches[0]!.radius += 1)],
    ['a spawner accumulator', (world) => (world.spawners.food.accumulator += 0.5)],
    ['a spawner flag', (world) => (world.spawners.dnaFragments.isEnabled = true)],
    ['a random stream', (world) => (world.random.spawner = { ...world.random.spawner, position: 7 })],
    ['the entity counter', (world) => (world.nextEntityNumber += 1)],
  ])('changes when %s changes', (_label, mutate) => {
    const base = computeStateHash(populatedWorld());
    const changed = populatedWorld();
    mutate(changed);
    expect(computeStateHash(changed)).not.toBe(base);
  });

  it('ignores the derived data', () => {
    const base = computeStateHash(populatedWorld());
    const world = populatedWorld();
    world.leaderboard = [];
    world.effects.push({ kind: 'respawn', tick: 0, x: 0, y: 0, cellId: world.cells[0]!.id, playerId: 'p1' as never });
    world.players[0]!.score = 99;
    world.players[0]!.offer = { offerId: 1, cards: [], expiresAtTick: 0 };
    world.cells[0]!.modifiers = { ...world.cells[0]!.modifiers, speedMultiplier: 2 };
    expect(computeStateHash(world)).toBe(base);
  });

  it('throws on a non-finite number', () => {
    const world = populatedWorld();
    world.cells[0]!.mass = Number.NaN;
    expect(() => computeStateHash(world)).toThrow(StateHashError);
  });
});

describe('HASHED_FIELDS pin every non-derived record field', () => {
  const world = populatedWorld();

  it('world scalars', () => {
    const nested = ['cells', 'food', 'dnaFragments', 'players', 'gelPatches', 'spawners', 'random', 'nextEntityNumber'];
    const expected = Object.keys(world)
      .filter((key) => !nested.includes(key) && !(DERIVED_FIELDS.world as readonly string[]).includes(key))
      .sort();
    expect(keysOf(WORLD_SCALAR_HASHED_FIELDS)).toEqual(expected);
  });

  it('cells', () => {
    const expected = Object.keys(world.cells[0]!).filter(
      (key) => !(DERIVED_FIELDS.cell as readonly string[]).includes(key),
    );
    expect(keysOf(CELL_HASHED_FIELDS)).toEqual(expected.sort());
  });

  it('players', () => {
    const expected = Object.keys(world.players[0]!).filter(
      (key) => !(DERIVED_FIELDS.player as readonly string[]).includes(key),
    );
    expect(keysOf(PLAYER_HASHED_FIELDS)).toEqual(expected.sort());
  });

  it('motes, fragments, gel patches and spawners', () => {
    expect(keysOf(FOOD_MOTE_HASHED_FIELDS)).toEqual(Object.keys(world.food[0]!).sort());
    expect(keysOf(DNA_FRAGMENT_HASHED_FIELDS)).toEqual(Object.keys(world.dnaFragments[0]!).sort());
    expect(keysOf(GEL_PATCH_HASHED_FIELDS)).toEqual(Object.keys(world.gelPatches[0]!).sort());
    expect(keysOf(SPAWNER_HASHED_FIELDS)).toEqual(Object.keys(world.spawners.food).sort());
  });
});
