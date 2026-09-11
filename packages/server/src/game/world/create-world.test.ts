// docs/ECOLOGY.md §8 E1 and docs/DETERMINISM.md §3: the seeded world at tick 0.
import { describe, expect, it } from 'vitest';
import {
  createTestSessionConfig,
  DEFAULT_BALANCE,
  FOOD_KIND,
  playerId,
  ROUND_PHASE,
  SERVER_RANDOM_STREAM_LABELS,
} from '@evolution/shared';
import { isInsideAnyCell } from '../simulation/spawn-point.js';
import { createWorld, type CreateWorldOptions } from './create-world.js';

const SEED = 42;
const { ecology, world: worldBalance, growth } = DEFAULT_BALANCE;
const ALGAE_SHARE_TOLERANCE = 0.06;

function options(overrides: Partial<CreateWorldOptions> = {}): CreateWorldOptions {
  return {
    seed: SEED,
    config: createTestSessionConfig({ seed: SEED }),
    balance: DEFAULT_BALANCE,
    players: [
      { playerId: playerId('p1'), playerName: 'Alice', avatarIndex: 0 },
      { playerId: playerId('p2'), playerName: 'Bob', avatarIndex: 1 },
    ],
    ...overrides,
  };
}

describe('createWorld', () => {
  const world = createWorld(options());

  it('starts at tick 0 of a playing round with the seed and its server streams', () => {
    expect(world.tick).toBe(0);
    expect(world.seed).toBe(SEED);
    expect(world.roundPhase).toBe(ROUND_PHASE.playing);
    expect(world.roundStartTick).toBe(0);
    expect(world.roundTimeLeftMs).toBe(world.config.roundDurationSeconds * 1000);
    expect(Object.keys(world.random).sort()).toEqual([...SERVER_RANDOM_STREAM_LABELS].sort());
  });

  it('places the gel patches inside the broth, apart and off the vent and shallows', () => {
    expect(world.gelPatches).toHaveLength(ecology.GEL_PATCH_COUNT);
    const inner = ecology.VENT_RADIUS + ecology.GEL_PATCH_RADIUS;
    const outer = worldBalance.DISH_RADIUS - ecology.SHALLOWS_WIDTH - ecology.GEL_PATCH_RADIUS;
    for (const patch of world.gelPatches) {
      expect(patch.radius).toBe(ecology.GEL_PATCH_RADIUS);
      const distance = Math.hypot(patch.x, patch.y);
      expect(distance).toBeGreaterThanOrEqual(inner);
      expect(distance).toBeLessThanOrEqual(outer);
    }
    for (const [index, patch] of world.gelPatches.entries()) {
      for (const other of world.gelPatches.slice(index + 1)) {
        expect(Math.hypot(patch.x - other.x, patch.y - other.y)).toBeGreaterThanOrEqual(ecology.GEL_PATCH_MIN_SPACING);
      }
    }
  });

  it('spawns the roster in join order, at starting mass, inside the spawn disc', () => {
    expect(world.players.map((player) => player.playerId)).toEqual(['p1', 'p2']);
    expect(world.players.map((player) => player.joinOrder)).toEqual([0, 1]);
    expect(world.cells.map((cell) => cell.playerId)).toEqual(['p1', 'p2']);
    for (const cell of world.cells) {
      expect(cell.mass).toBe(growth.CELL_STARTING_MASS);
      expect(Math.hypot(cell.x, cell.y)).toBeLessThanOrEqual(worldBalance.DISH_RADIUS - worldBalance.SPAWN_EDGE_MARGIN);
      expect(cell.level).toBe(1);
    }
    expect(world.leaderboard.map((row) => row.playerId)).toEqual(['p1', 'p2']);
  });

  it('E1: fills 0.6 × cap motes and fragments after placement, all inside the edge margin, none inside a cell', () => {
    const solo = createWorld(options({ players: [{ playerId: playerId('p1'), playerName: 'Alice', avatarIndex: 0 }] }));
    const foodCap = ecology.FOOD_CAP_BASE + ecology.FOOD_CAP_PER_PLAYER;
    const fragmentCap = ecology.DNA_FRAGMENT_CAP_BASE + ecology.DNA_FRAGMENT_CAP_PER_PLAYER;
    expect(solo.food).toHaveLength(Math.floor(ecology.FOOD_INITIAL_FILL_FRACTION * foodCap));
    expect(solo.dnaFragments).toHaveLength(Math.floor(ecology.DNA_FRAGMENT_INITIAL_FILL_FRACTION * fragmentCap));
    expect(solo.spawners.food.spawnedCount).toBe(solo.food.length);
    const reach = worldBalance.DISH_RADIUS - worldBalance.FOOD_EDGE_MARGIN;
    for (const mote of [...solo.food, ...solo.dnaFragments]) {
      expect(Math.hypot(mote.x, mote.y)).toBeLessThanOrEqual(reach);
      expect(isInsideAnyCell(mote, solo.cells)).toBe(false);
    }
    const algaeShare = solo.food.filter((mote) => mote.kind === FOOD_KIND.algae).length / solo.food.length;
    expect(Math.abs(algaeShare - ecology.FOOD_KIND_WEIGHTS_BY_WORLD_STAGE.protocell.algae)).toBeLessThanOrEqual(
      ALGAE_SHARE_TOLERANCE,
    );
    expect(solo.food.every((mote) => mote.kind !== FOOD_KIND.detritus)).toBe(true);
  });

  it('is a pure function of the seed and the roster', () => {
    expect(JSON.stringify(createWorld(options()))).toBe(JSON.stringify(createWorld(options())));
    expect(JSON.stringify(createWorld(options({ seed: SEED + 1 })))).not.toBe(JSON.stringify(createWorld(options())));
  });

  it('continues the tick and the entity counter when asked (a rematch)', () => {
    const continued = createWorld(options({ startTick: 37_200, nextEntityNumber: 5000 }));
    expect(continued.tick).toBe(37_200);
    expect(continued.cells[0]?.id).toBe('c-5000');
    expect(continued.nextEntityNumber).toBeGreaterThan(5000);
    expect(continued.roundStartTick).toBe(37_200);
  });
});
